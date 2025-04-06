import os

import matplotlib.pyplot as plt
import pandas as pd

CLIENT_COUNTS = [1, 4, 8]
RUNS = [1, 2, 3]
CLIENT_MONITORING_DATA = "../../../benchmarking/upload_benchmarking/monitoring/"
OUTPUT = "plots/"


def plot_server_cpu_usage(client_count, run, rsf):
    # Get start and end timestamps of upload tests from client monitoring data
    socket_df = pd.read_csv(
        f"{CLIENT_MONITORING_DATA}socket/test_run_{run}/rsf_{rsf}/upload_test_monitoring_socket_{client_count}.csv",
        skipfooter=1, engine="python")
    http_df = pd.read_csv(
        f"{CLIENT_MONITORING_DATA}http/test_run_{run}/rsf_{rsf}/upload_test_monitoring_http_{client_count}.csv",
        skipfooter=1, engine="python")
    socket_start_time = socket_df["Timestamp"].iloc[0]
    socket_end_time = socket_df["Timestamp"].iloc[-1]
    http_start_time = http_df["Timestamp"].iloc[0]
    http_end_time = http_df["Timestamp"].iloc[-1]

    # Get cpu usage of server
    cpu_usage_df = pd.read_csv(f"./test_run_{run}/rsf_{rsf}/server_cpu_usage.csv")

    # Get measurements taken between start and end time
    socket_cpu_usage_df = cpu_usage_df[
        (cpu_usage_df["Timestamp"] >= socket_start_time) & (cpu_usage_df["Timestamp"] <= socket_end_time)
        ]
    http_cpu_usage_df = cpu_usage_df[
        (cpu_usage_df["Timestamp"] >= http_start_time) & (cpu_usage_df["Timestamp"] <= http_end_time)
        ]

    # Make timestamps relative to start time
    socket_time_diffs = socket_cpu_usage_df["Timestamp"] - socket_start_time
    http_time_diffs = http_cpu_usage_df["Timestamp"] - http_start_time

    # Plot data
    plt.figure(figsize=(20, 5))
    plt.xticks(fontsize=18)
    plt.yticks(fontsize=18)
    plt.plot(socket_time_diffs, socket_cpu_usage_df["CPU_Percentage"], label="Socket", linestyle="-", linewidth=3)
    plt.plot(http_time_diffs, http_cpu_usage_df["CPU_Percentage"], label="HTTP", linestyle="-", linewidth=3)

    # Add labels and legend
    plt.xlabel("Time (s)", fontsize=18)
    plt.ylabel("CPU usage (%)", fontsize=18)
    plt.title(f"Run={run}; Clients={client_count}; RSF={rsf}", fontsize=18)
    plt.legend(fontsize=18)
    plt.grid(True)
    plt.tight_layout()
    plt.savefig(f"{OUTPUT}server_cpu_usage__run_{run}__clients_{client_count}__rsf_{rsf}.png")
    # plt.show()


# Create output directory
os.makedirs(OUTPUT, exist_ok=True)

# Plot server's CPU usage for multiple test runs, client counts and RSFs
for run in RUNS:
    for client_count in CLIENT_COUNTS:
        plot_server_cpu_usage(client_count, run, 1)
        plot_server_cpu_usage(client_count, run, 8)
