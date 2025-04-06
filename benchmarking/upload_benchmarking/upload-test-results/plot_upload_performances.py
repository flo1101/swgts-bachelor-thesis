import os

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

RUNS = [1, 2, 3]
OUTPUT = "plots/"


def plot_socket_http_upload_performance(run, rsf):
    """Plots HTTP and WebSocket upload performances measured during playwright tests"""
    # Load data from CSV files
    http_file_path = f"http/test_run_{run}/rsf_{rsf}/http_upload_performance_parallel.csv"
    socket_file_path = f"socket/test_run_{run}/rsf_{rsf}/socket_upload_performance_parallel.csv"

    df_http = pd.read_csv(http_file_path, sep=",")
    df_socket = pd.read_csv(socket_file_path, sep=",")

    # Group results by client count and get average performance per group
    http_grouped_by_client_count = df_http.groupby("Client Count")
    socket_grouped_by_client_count = df_socket.groupby("Client Count")

    http_avg_group_upload_times = http_grouped_by_client_count["Upload Time (s)"].mean()

    # Get client counts
    client_counts = http_avg_group_upload_times.index
    plt.figure(figsize=(10, 6))

    for i, client_count in enumerate(client_counts):
        # Extract data
        http_group = http_grouped_by_client_count.get_group(client_count)
        socket_group = socket_grouped_by_client_count.get_group(client_count)

        http_upload_times = http_group["Upload Time (s)"].values
        socket_upload_times = socket_group["Upload Time (s)"].values

        # Plot datapoints
        plt.scatter(np.full_like(http_upload_times, i - 0.2), http_upload_times, color="darkorange", alpha=0.6,
                    label="HTTP" if i == 0 else "")
        plt.scatter(np.full_like(socket_upload_times, i + 0.2), socket_upload_times, color="royalblue", alpha=0.6,
                    label="Socket" if i == 0 else "")

        # Plot averages
        http_avg = np.mean(http_upload_times)
        socket_avg = np.mean(socket_upload_times)

        plt.plot([i - 0.4, i], [http_avg, http_avg], color="darkorange", linewidth=2, linestyle='-')
        plt.text(i - 0.4, http_avg + 0.1, f"{round(http_avg)}", ha='center', va='bottom', color="darkorange")

        plt.plot([i, i + 0.4], [socket_avg, socket_avg], color="royalblue", linewidth=2, linestyle='-')
        plt.text(i, socket_avg + 0.1, f"{round(socket_avg)}", ha='center', va='bottom', color="royalblue")

    plt.xticks(range(len(client_counts)), client_counts)
    plt.xlabel("Number of clients")
    plt.ylabel("Upload time (s)")
    plt.title(f"Run={run}; RSF={rsf}")
    plt.legend()
    plt.grid(axis='y', linestyle='--', alpha=0.7)
    plt.savefig(f"{OUTPUT}upload_performance__run_{run}__rsf_{rsf}.png")
    # plt.show()


# Create output directory
os.makedirs(OUTPUT, exist_ok=True)

# Plot performances for multiple test runs and RSFs
for i in RUNS:
    plot_socket_http_upload_performance(i, 1)
    plot_socket_http_upload_performance(i, 8)
