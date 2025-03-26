import matplotlib.pyplot as plt
import pandas as pd

CLIENT_COUNTS = [1, 4, 8]
CLIENT_MONITORING_DATA = "../../../benchmarking/upload_benchmarking/monitoring/"
RUNS = 3


def plot_api_cpu_usage(client_count, run, rsf):
    # Get start timestamps
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

    # Get cpu usage of api container
    cpu_usage_df = pd.read_csv(f"./test_run_{run}/rsf_{rsf}/api_cpu_usage.csv")

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
    plt.plot(socket_time_diffs, socket_cpu_usage_df["user"], label="Socket", linestyle="-")
    plt.plot(http_time_diffs, http_cpu_usage_df["user"], label="HTTP", linestyle="-")

    # Add labels and legend
    plt.xlabel("Time (s)")
    plt.ylabel("CPU usage (%)")
    plt.title(f"API CPU usage during upload; Run={run}; Clients={client_count}; RSF={rsf}")
    plt.legend()
    plt.grid(True)

    # Save and show plot
    plt.savefig(f"plots/api_cpu_usage__run_{run}__clients_{client_count}__rsf_{rsf}.png")
    plt.show()


# Plot data for different test runs, client counts and rsf
for run in range(1, RUNS + 1):
    for client_count in CLIENT_COUNTS:
        plot_api_cpu_usage(client_count, run, 1)
        plot_api_cpu_usage(client_count, run, 8)
