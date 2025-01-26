# coding=utf-8
from typing import Union

from flask import Flask, request, make_response
from flask_cors import CORS
from flask_socketio import SocketIO

from .context_manager import *
from .version import VERSION_INFORMATION

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, debug=True, cors_allowed_origins="*")


def request_data():
    """Request data from client"""
    app.logger.info("Requesting data from client.")
    socketio.emit("dataRequest")


# SocketIO listeners
@socketio.on("connect")
def handle_connect():
    """Handle successful connection with client"""
    app.logger.info("Socket connection to client established.")
    # TODO: create context and request data (data.size = buffer_size)
    request_data()


@socketio.on("disconnect")
def handle_disconnect():
    """Handle disconnection from client"""
    app.logger.info("Socket disconnected.")


@socketio.on("dataUpload")
def handle_data_upload(data):
    """Handle data uploaded from client"""
    app.logger.info(f"Received data from client: {data}")


# Http routes
@app.route('/server-status', methods=['GET'])
def server_status() -> dict[str, Union[str, float]]:
    """Returns information about the server. Unfortunately, proper version discovery only works if the package is
    installed, which is true for the deployment Dockerfile. Reading the git revision would require additional
    dependencies. """
    answer: dict[str, Union[str, float]] = VERSION_INFORMATION.copy()
    answer['uptime'] = time() - SERVER_LAUNCH_TIME
    answer['bufferSize'] = app.config['MAXIMUM_PENDING_BYTES']
    return make_response(answer, 200)


@app.route('/context/create', methods=['POST'])
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


@app.route('/context/<uuid:context_id>/close', methods=['POST'])  # TODO: Avoid race condition (close before last reads)
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


@app.route('/context/<uuid:context_id>/reads', methods=['POST'])
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

# Record the server launch time
SERVER_LAUNCH_TIME = time()

# Log that the server has started
app.logger.info('Server launched.')
