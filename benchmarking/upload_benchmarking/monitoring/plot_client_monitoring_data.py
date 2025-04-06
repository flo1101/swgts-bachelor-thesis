import os

import matplotlib.pyplot as plt
import pandas as pd

CLIENT_COUNTS = [1, 4, 8]
RUNS = [1, 2, 3]
OUTPUT = "plots/"


def plot_data_sent_mode(client_count, run, rsf):
    # Load CSVs
    socket_filename = f"socket/test_run_{run}/rsf_{rsf}/upload_test_monitoring_socket_{client_count}.csv"
    http_filename = f"http/test_run_{run}/rsf_{rsf}/upload_test_monitoring_http_{client_count}.csv"
    socket_df = pd.read_csv(socket_filename, skipfooter=1)
    http_df = pd.read_csv(http_filename, skipfooter=1)

    # Extract data to plot
    socket_sent = socket_df["Bytes_Sent"] / 125000
    http_sent = http_df["Bytes_Sent"] / 125000
    socket_timestamps = socket_df["Timestamp"]
    http_timestamps = http_df["Timestamp"]

    socket_start_time = socket_timestamps.iloc[0]
    http_start_time = http_timestamps.iloc[0]
    socket_time_diffs = socket_timestamps - socket_start_time
    http_time_diffs = http_timestamps - http_start_time

    # Plot data
    plt.figure(figsize=(10, 5))
    plt.plot(socket_time_diffs, socket_sent, label="Socket sent", linestyle="-")
    plt.plot(http_time_diffs, http_sent, label="HTTP sent", linestyle="-")

    # Add labels and legend
    plt.xlabel("Time (s)")
    plt.ylabel("Network output (Mbps)")
    plt.title(f"Run={run}; Clients={client_count}; RSF={rsf}")
    plt.legend()
    plt.grid(True)
    plt.savefig(
        f"{OUTPUT}client_network_upload__run_{run}__clients_{client_count}__rsf_{rsf}.png")
    # plt.show()


# Create output directory
os.makedirs(OUTPUT, exist_ok=True)

# Plot network output for multiple test runs, client counts and RSFs
for run in RUNS:
    for client_count in CLIENT_COUNTS:
        plot_data_sent_mode(client_count, run, 1)
        plot_data_sent_mode(client_count, run, 8)
