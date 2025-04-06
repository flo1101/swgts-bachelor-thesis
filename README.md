# SWGTS - Application extension and performance optimization

This repository provides an extension of SWGTS (<https://doi.org/10.1093/bioinformatics/btae332>) by implementing the
upload process through WebSockets.
End-2-end testing is used to evaluate the performance of the new upload approach for different numbers of concurrent
clients,
In addition, Python scripts are provided to monitor network usage and CPU utilization during uploads.

## Application extension

The WebSocket upload implements the same approach of using a serverside buffer to limit the amount of unfiltered
data held on the server.
The difference lies in the way data during uploads is exchanged between clients and server. This happens over a
persistent WebSocket connection that is established on upload start instead of independent HTTP connections.
While during an HTTP upload data is constantly emitted by clients and eventually rejected by the server, WebSocket
clients only send data on request by the server preventing data rejection.

### API

Since the API needs to provide WebSocket support on top of HTTP, the previous Flask backend has exchanged by a <b>
Flask-Socket.IO</b> backend.
This keeps the existing logic and HTTP endpoints and adds support for WebSocket listeners, through which the new upload
has been implemented. The server-side implementation of these listeners alongside the HTTP endpoints can be found
in [app.py](swgts-backend/swgts_api/src/swgts_api/app.py).
The previous Apache server that provided the backend has been exchanged for an <b>Eventlet</b> based server, because
Apache does not support WebSockets by default.

### Frontend

The frontend has been extended to support the client-side logic for WebSocket uploads through the use of the <b>
Socket.IO
Client API</b>.
Similar to the API, the WebSocket upload is handled through registration of listeners to handle upload-events.
The client-side implementation of these listeners can be found
in [socketHooks.js](swgts-frontend/src/hooks/socketHooks.js).
The user interface of the frontend has been visually slightly adjusted but provide the same functionalities as prior.

### Traefik

Traefik as the applications reverse proxy acts as the applications interface for client interaction.
Therefore, the underlying configuration was modified to allow for the forwarding of WebSocket requests in addition to
HTTP.

### Filter

Host depletion is generally handled in the same way as for HTTP through multiple parallel workers.
However, for WebSocket uploads each worker sends and HTTP request to the API after processing of a job is finished.
This triggers the request of new data from the client by the API, as after processing buffer space is available again.

## Performance evaluation

### Playwright tests

The time required for HTTP and WebSocket uploads can be measured through end-2-end <b>Playwright</b> tests.
Each test measures the upload performance by simulating a browser instance and utilizing the provided user interface to
trigger an upload.
The time elapsed between initiation and completion is tracked and written to a CSV file.
This is also possible for multiple simultaneously uploading clients, as Playwright tests can be executed in
parallel. The files for WebSocket and HTTP upload tests can be found in
the [tests](benchmarking/upload_benchmarking/tests) subdirectory and the resulting CSV files in
the [upload-test-results](benchmarking/upload_benchmarking/upload-test-results) subdirectory.

### Client monitoring

During upload test the clients network output and CPU usage can be monitored through
the [plot_client_monitoring_data.py](benchmarking/upload_benchmarking/monitoring/plot_client_monitoring_data.py) script.
It utilizes <b>Psutil</b> to retrieve the relevant system data in one-second intervals and saves the results with
corresponding timestamps in the [monitoring](benchmarking/upload_benchmarking/monitoring) subdirectory.

For executing the Playwright test alongside client monitoring
the [run_upload_tests.py](benchmarking/upload_benchmarking/run_upload_tests.py) script is provided.
It should be called with the `--mode` and `--workers` paramters where `--mode` defines the upload implementation that
should be tested (either `http` for HTTP or `socket` for WebSocket) and `--workers` defines the number of concurrent
uploading clients. The test will be performed consecutively for all numers of parallel clients up to the amount defined
through `--workers`.

### Server monitoring

In a similar way Psutil is used to monitor the server's CPU usage during uploads as implemented
in [run_server_monitoring.py](swgts-backend/swgts_filter/monitoring/run_server_monitoring.py).
The same is possible for individual system components by monitoring the CPU usage of individual docker containers
through Linux control groups.
This is currently only implemented for the API container
in [run_api_monitoring.py](swgts-backend/swgts_api/monitoring/run_api_monitoring.py) but is applicable for other
containers in the same way.
The mentioned scripts are copied into the corresponding containers on server start but not run by default. This needs to
be done manually if server monitoring is required.
Results are written to CSV as done for the client monitoring.

### Visualizing results

Scripts for plotting the measured upload times as well as client and server monitoring data are provided
through [plot_upload_performances.py](benchmarking/upload_benchmarking/upload-test-results/plot_upload_performances.py), [plot_client_monitoring_data.py](benchmarking/upload_benchmarking/monitoring/plot_client_monitoring_data.py), [plot_server_cpu_usage.py](swgts-backend/swgts_filter/monitoring/plot_server_cpu_usage.py)
and [plot_api_cpu_usage.py](swgts-backend/swgts_api/monitoring/plot_api_cpu_usage.py).
These currently assume test results are provided for multiple test runs as this is how testing was previously executed.
If plotting is required to be done for single tests, the files need to be adjusted accordingly.