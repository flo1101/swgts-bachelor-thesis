import matplotlib.pyplot as plt
import pandas as pd

MAX_CLIENT_COUNT = 8


def plot_data_sent_mode(client_count):
    # Load CSVs
    socket_filename = f"socket/upload_test_monitoring_socket_{client_count}.csv"
    http_filename = f"http/upload_test_monitoring_http_{client_count}.csv"
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
    plt.ylabel("Data sent (Mbps)")
    plt.title(f"Client network output: HTTP vs Socket; Clients: {client_count}")
    plt.legend()
    plt.grid(True)

    # Save and show plot
    plt.savefig(f"client_network_upload_{client_count}.png")
    plt.show()


def plot_data_sent_clients(client_counts, mode):
    plt.figure(figsize=(40, 5))

    for client_count in client_counts:
        df = pd.read_csv(f"{mode}/upload_test_monitoring_{mode}_{client_count}.csv", skipfooter=1)
        data_sent = df["Bytes_Sent"] / 125000
        timestamps = df["Timestamp"] - df["Timestamp"].iloc[0]
        plt.plot(timestamps, data_sent, label=f"Client count = {client_count}", linestyle="-")

    plt.xlabel("Time (s)")
    plt.ylabel("Data sent (Mbps)")
    plt.title(f"Client network output {mode}")
    plt.legend()
    plt.grid(True)
    plt.show()


# Plot http vs socket data for individual client counts
for client_count in range(1, MAX_CLIENT_COUNT + 1):
    plot_data_sent_mode(client_count)

# Plot socket data for different clients
# client_counts = [2, 7]
# plot_data_sent_clients(client_counts, "socket")
