# coding=utf-8
from typing import Union

from flask import Flask, request, make_response, Response
from flask_cors import CORS
from flask_socketio import SocketIO, join_room

from .context_manager import *
from .version import VERSION_INFORMATION

app = Flask(__name__)
CORS(app, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*", path='/api/socket.io', max_http_buffer_size=10_000_000)


def request_data(requested_bytes, context_id):
    """Request data from client"""
    app.logger.info(f"({context_id}): Requesting {requested_bytes} bytes from client.")
    socketio.emit("dataRequest", {"bytes": requested_bytes, "contextId": str(context_id),
                                  "bufferFill": get_pending_bytes_count(context_id),
                                  "processedReads": get_processed_read_count(context_id)}, to=str(context_id))


# SocketIO listeners
@socketio.on("connect")
def handle_connect():
    """Handle successful connection with client"""
    app.logger.info("Socket connection to client established.")


@socketio.on("disconnect")
def handle_disconnect():
    """Handle disconnection from client"""
    # Socket leaves rooms automatically on disconnect
    app.logger.info("Socket disconnected.")


@socketio.on("createContext")
def handle_create_context(payload):
    """
    Handle context creation request from client.
    When context has been created successfully, request data from client.
    """
    app.logger.info("Received context creation request from client.")
    filenames = payload.get("filenames")
    session_id = request.sid  # if context creation fails use session id to send error message

    if filenames is None:
        socketio.emit('contextCreationError', {'message': 'filenames missing in request.'}, to=session_id)
        return
    if not isinstance(filenames, list):
        socketio.emit('contextCreationError', {'message': 'filenames is not a list.'}, to=session_id)
        return

    context_id = create_context(filenames=filenames)
    if context_id is None:
        app.logger.error('Could not create context.')
        socketio.emit('contextCreationError', {'message': 'Could not create context.'}, to=session_id)
        return

    # To emit messages to a specific client/context, the context_id is used to create a client/context specific room
    join_room(str(context_id))

    # Request data from client in multiple chunks, so we can multithread the filtering even for one client
    request_size_factor, bytes_per_request = get_socket_request_info()
    for i in range(request_size_factor):
        request_data(bytes_per_request, context_id)


@socketio.on("closeContext")
def handle_close_context(payload):
    """Handle context closing request from client"""
    context_id = payload.get("contextId")
    if not context_exists(context_id):
        socketio.emit("contextCloseError", {'message': f'Tried to close non-existent context {context_id}.'},
                      to=str(context_id))
        return

    app.logger.info(f"({context_id}): Received context closing request from client.")

    # We test if the context still has pending bytes and only delete it if no more bytes are pending (everything is filtered)
    pending_bytes: int = get_pending_bytes_count(context_id)
    if pending_bytes != 0:
        socketio.emit("contextCloseError", {'message': 'There are still reads pending, try again later!'},
                      to=str(context_id))
        return

    result = close_context(context_id, app.config['HANDS_OFF'])
    if result is None:
        socketio.emit("contextCloseError", {'message': 'Could not close context'}, to=str(context_id))
        return
    else:
        socketio.emit("contextClosed", {'contextId': context_id, 'savedReads': result[1], 'processedReads': result[0]},
                      to=str(context_id))
        app.logger.info(f'({context_id}): Closed context, saved {len(result[1])} of {result[0]}.')
        return


@socketio.on("dataUpload")
def handle_data_upload(payload):
    """Handle data uploaded from client"""
    request_reception_time = time()

    chunk: list[list[list[str]]] = payload.get("data")
    bytes: int = payload.get("bytes")
    context_id: UUID = payload.get("contextId")
    app.logger.info(f"({context_id}): Received {bytes} bytes from client.")

    if not context_exists(context_id):
        socketio.emit("dataUploadError", {'message': f'No context with id {context_id} found.'}, to=str(context_id))

    if not isinstance(chunk, list):
        socketio.emit("dataUploadError", {'message': 'Passed read chunks are not in list format.'}, to=str(context_id))

    effective_cumulated_chunk_size: int = 0
    pair_count: int = get_pair_count(
        context_id)  # We expect as many reads to be paired as we have open file streams. (Support for strobe reads in theory)

    pairs_short_enough = []
    for pair in chunk:
        if not isinstance(pair, list):
            socketio.emit("dataUploadError", {'message': 'There is a pair which is not a list.'}, to=str(context_id))

        if len(pair) != pair_count:
            socketio.emit("dataUploadError",
                          {'message': f'Expected {pair_count}-paired reads but found pair with {len(pair)} reads.'},
                          to=str(context_id))

        filtered_pair = []
        for read in pair:
            if not isinstance(read, list):
                socketio.emit("dataUploadError", {'message': 'There is a read which is not a list.'},
                              to=str(context_id))
            if len(read) != 4:
                socketio.emit("dataUploadError", {'message': 'There is a read with a length != 4.'}, to=str(context_id))
            # Here would be the place to perform additional sanity checks

            # Check if the read length is within the allowed buffer size
            if len(read[1]) <= app.config['MAXIMUM_PENDING_BYTES']:
                # Only count the length of the actual sequence
                effective_cumulated_chunk_size += len(read[1])
                filtered_pair.append(read)
            else:
                increment_processed_bases(len(read[1]))
                # The read will be discarded anyway and doesn't matter for buffer calculation
                break
        else:
            # All reads fit the size and can be enqueued for filtering
            pairs_short_enough.append(filtered_pair)

    current_pending: int = get_pending_bytes_count(context_id)
    excess: int = current_pending + effective_cumulated_chunk_size - app.config['MAXIMUM_PENDING_BYTES']

    if effective_cumulated_chunk_size > app.config['MAXIMUM_PENDING_BYTES']:
        app.logger.info(f"({context_id}): You sent a chunk that is larger than the configured buffer size.")
        app.logger.info(
            f"Effective cumulated chunk size: {effective_cumulated_chunk_size}. Buffer size: {app.config['MAXIMUM_PENDING_BYTES']}.")

        socketio.emit("dataUploadError", {'message': 'You sent a chunk that is larger than the configured buffer size'},
                      to=str(context_id))
        return

    elif excess > 0:
        socketio.emit("dataUploadError", {'message': 'You sent too much data.'}, to=str(context_id))
        return

    # Execution from here on means accepting the chunk and processing the reads
    # Adjust pending bytes stat in redis
    change_pending_bytes_count(context_id, effective_cumulated_chunk_size)
    increase_processed_read_count(context_id, len(chunk) - len(pairs_short_enough))

    # Enqueue valid read pairs for processing
    if len(pairs_short_enough) > 0:
        enqueue_chunks(pairs_short_enough, context_id, effective_cumulated_chunk_size, request_reception_time)

    # TODO: save client latency in redis queue here if needed


# Http routes
@app.route('/api/context/<uuid:context_id>/request-data', methods=['POST'])
def post_request_data(context_id: UUID) -> Response:
    app.logger.info('Requesting data from client.')
    """Called by filters to requests data from client once data in buffer has been processed"""
    if not context_exists(context_id):
        app.logger.warning(f'Tried to request data from non-existent context {context_id}.')
        return make_response({'message': 'No such context.'}, 404)

    json_body: dict[str, Any]
    try:
        json_body = request.get_json()
        if 'bytes_to_request' not in json_body:
            return make_response({'message': 'bytes_to_request missing in request.'}, 400)
        if not isinstance(json_body['bytes_to_request'], int):
            return make_response({'message': 'bytes_to_request is not an integer.'}, 400)
    except TypeError:
        return make_response({'message': 'expected json body.'}, 400)

    request_data(json_body['bytes_to_request'], context_id)
    return make_response({'message': 'Data requested.'}, 200)


@app.route('/api/server-status', methods=['GET'])
def server_status() -> dict[str, Union[str, float]]:
    """Returns information about the server. Unfortunately, proper version discovery only works if the package is
    installed, which is true for the deployment Dockerfile. Reading the git revision would require additional
    dependencies. """
    answer: dict[str, Union[str, float]] = VERSION_INFORMATION.copy()
    answer['uptime'] = time() - SERVER_LAUNCH_TIME
    answer['bufferSize'] = app.config['MAXIMUM_PENDING_BYTES']
    return make_response(answer, 200)


@app.route('/api/context/create', methods=['POST'])
def context_create() -> dict[str, UUID]:
    json_body: dict[str, Any]
    try:
        json_body = request.get_json()
        if 'filenames' not in json_body:
            return make_response({'message': 'filenames missing in request.'}, 400)
        if not isinstance(json_body['filenames'], list):
            return make_response({'message': 'filenames is not a list.'}, 400)
    except TypeError:
        return make_response({'message': 'expected json body.'}, 400)

    context = create_context(filenames=json_body['filenames'])
    if context is None:
        app.logger.error('Could not create context.')

    return {'context': context}


@app.route('/api/context/<uuid:context_id>/close',
           methods=['POST'])  # TODO: Avoid race condition (close before last reads)
def post_close_context(context_id: UUID) -> dict[str, Union[int, str, list[str]]]:
    if not context_exists(context_id):
        app.logger.warning(f'Tried to close non-existent context {context_id}.')
        return make_response({'message': 'No such context.'}, 404)

    # We test if the context still has pending bytes and only delete it if no more bytes are pending (everything is filtered)
    pending_bytes: int = get_pending_bytes_count(context_id)
    if pending_bytes != 0:
        return make_response({
            'message': 'There are still reads pending, try again later!',
            'retryAfter': pending_bytes * get_queue_speed(context_id),
            'processedReads': get_processed_read_count(context_id),
            'pendingBytes': pending_bytes
        }, 503)

    result = close_context(context_id, app.config['HANDS_OFF'])
    if result is None:
        return make_response({'message': 'Could not close context.'}, 500)
    else:
        app.logger.info(f'Closed context {context_id}, saved {len(result[1])} of {result[0]}.')
        return make_response({'readsSaved': result[1], 'readsProcessed': result[0]}, 200)


@app.route('/api/context/<uuid:context_id>/reads', methods=['POST'])
def post_context_reads(context_id: UUID) -> dict[str, Union[int, str]]:
    request_reception_time = time()

    # Check if the context exists
    if not context_exists(context_id):
        return make_response({'message': f'No context with id {context_id} found.'}, 404)

    # Try to get the JSON body from the request
    try:
        chunk: list[list[list[str]]] = request.get_json()
    except TypeError:
        return make_response({'message': 'Expected json body.'}, 400)
    except OSError:
        return make_response({'message': 'The connection was interrupted.'}, 400)

    # Validate chunk format
    if not isinstance(chunk, list):
        return make_response({'message': 'Passed read chunks are not in list format.'}, 400)

    effective_cumulated_chunk_size: int = 0
    pair_count: int = get_pair_count(
        context_id)  # We expect as much reads to be paired as we have open file streams. (Support for strobe reads in theory)

    pairs_short_enough = []
    for pair in chunk:
        if not isinstance(pair, list):
            return make_response({'message': 'There is a pair which is not a list.'}, 400)

        if len(pair) != pair_count:
            return make_response(
                {'message': f'Expected {pair_count}-paired reads but found pair with {len(pair)} reads.'}, 400)

        filtered_pair = []
        for read in pair:
            if not isinstance(read, list):
                return make_response({'message': 'There is a read which is not a list.'}, 400)
            if len(read) != 4:
                return make_response({'message': 'There is a read with a length != 4.'}, 400)
            # Here would be the place to perform additional sanity checks

            # Check if the read length is within the allowed buffer size
            if len(read[1]) <= app.config['MAXIMUM_PENDING_BYTES']:
                # Only count the length of the actual sequence
                effective_cumulated_chunk_size += len(read[1])
                filtered_pair.append(read)
            else:
                increment_processed_bases(len(read[1]))
                # The read will be discarded anyways and doesn't matter for buffer calculation
                break
        else:
            # All reads fit the size and can be enqueued for filtering
            pairs_short_enough.append(filtered_pair)

    current_pending: int = get_pending_bytes_count(context_id)
    excess: int = current_pending + effective_cumulated_chunk_size - app.config['MAXIMUM_PENDING_BYTES']

    if effective_cumulated_chunk_size > app.config['MAXIMUM_PENDING_BYTES']:
        resp = make_response(
            {'message': f'You sent a chunk that is larger than the configured buffer size',
             'processedReads': get_processed_read_count(context_id),
             'retryAfter': excess * get_queue_speed(context_id)  # current average response time
             }, 413)
        return resp

    elif excess > 0:
        resp = make_response(
            {'message': f'You sent too much data.',
             'pendingBytes': current_pending,
             'processedReads': get_processed_read_count(context_id),
             'retryAfter': excess * get_queue_speed(context_id)  # current average response time
             }, 422)
        return resp

    # Execution from here on means accepting the chunk and processing the reads
    # Adjust pending bytes stat in redis
    current_pending = change_pending_bytes_count(context_id, effective_cumulated_chunk_size)

    increase_processed_read_count(context_id, len(chunk) - len(pairs_short_enough))

    # Enqueue valid read pairs for processing
    if len(pairs_short_enough) > 0:
        enqueue_chunks(pairs_short_enough, context_id, effective_cumulated_chunk_size, request_reception_time)

    return make_response({
        'processedReads': get_processed_read_count(context_id),
        'pendingBytes': current_pending},
        200)


# Load the default configuration from 'config.py'
app.config.from_pyfile('config.py')

# Check if an additional configuration file exists and load it if found
if os.path.exists(app.config['CONFIG_FILE']):
    print('found additional config file, overwriting defaults ...')
    app.config.from_pyfile(app.config['CONFIG_FILE'])

# Set up logging configuration
logging.basicConfig(
    filename=app.config['LOG_FILE'],  # Log file path
    level='INFO',  # Log level
    format='%(asctime)s:%(levelname)s:%(name)s:%(message)s'  # Log message format
)

# Add a stream handler to also output logs to the console
logging.getLogger().addHandler(logging.StreamHandler())

# Log all configuration settings for debugging purposes
for k in app.config:
    app.logger.info(f'Configuration {k} -> {app.config[k]}')

# Log the attempt to connect to the stateful backend
app.logger.info('Connecting to stateful backend.')

# Initialize the state server (e.g., Redis) using the configuration
setup_state_server(app.config)

# Check the connection to the state server and exit if the connection fails
if not redis_ping():
    app.logger.fatal('Could not connect to stateful backend. Goodbye.')
    sys.exit(1)

# Share the context timeout setting with the state server
share_timeout(app.config['CONTEXT_TIMEOUT'])

# Share the maximum pending bytes setting with the state server
share_maximum_pending_bytes(app.config['MAXIMUM_PENDING_BYTES'])

# Share request size factor
share_request_size_factor(app.config['REQUEST_SIZE_FACTOR'])

# Record the server launch time
SERVER_LAUNCH_TIME = time()

# Log that the server has started
app.logger.info('Server launched.')
