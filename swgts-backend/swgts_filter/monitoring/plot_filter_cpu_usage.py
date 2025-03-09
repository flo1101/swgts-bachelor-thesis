import matplotlib.pyplot as plt
import pandas as pd

MAX_CLIENT_COUNT = 8


def plot_http_socket_cpu_filter_cpu_usage(client_count):
    # Get start timestamps
    socket_df = pd.read_csv(
        f"../../../benchmarking/upload_benchmarking/monitoring/socket/upload_test_monitoring_socket_{client_count}.csv",
        skipfooter=1, engine="python")
    http_df = pd.read_csv(
        f"../../../benchmarking/upload_benchmarking/monitoring/http/upload_test_monitoring_http_{client_count}.csv",
        skipfooter=1, engine="python")
    socket_start_time = socket_df["Timestamp"].iloc[0]
    socket_end_time = socket_df["Timestamp"].iloc[-1]
    http_start_time = http_df["Timestamp"].iloc[0]
    http_end_time = http_df["Timestamp"].iloc[-1]

    # Get cpu usage of filter container
    cpu_usage_df = pd.read_csv("./filter_cpu_usage.csv")

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
    plt.plot(socket_time_diffs, socket_cpu_usage_df["CPU_Percentage"], label="Socket", linestyle="-")
    plt.plot(http_time_diffs, http_cpu_usage_df["CPU_Percentage"], label="HTTP", linestyle="-")

    # Add lables and legend
    plt.xlabel("Time (s)")
    plt.ylabel("CPU usage (%)")
    plt.title(f"Filter CPU usage during upload; Clients: {client_count}; RSF: 1")
    plt.legend()
    plt.grid(True)

    # Save and show plot
    plt.savefig(f"filter_cpu_usage_{client_count}.png")
    plt.show()


for client_count in range(1, MAX_CLIENT_COUNT + 1):
    plot_http_socket_cpu_filter_cpu_usage(client_count)
