import glob

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

MAX_CLIENT_COUNT = 8

socket_csv_files = glob.glob("socket/*.csv")
socket_data = []
http_data = []

# Load data from CSVs
for client_count in range(1, MAX_CLIENT_COUNT + 1):
    socket_filename = f"socket/upload_test_monitoring_socket_{client_count}.csv"
    http_filename = f"http/upload_test_monitoring_http_{client_count}.csv"
    socket_df = pd.read_csv(socket_filename)
    http_df = pd.read_csv(http_filename)

    if not socket_df.empty:
        last_row = socket_df.iloc[-1]
        socket_data.append(last_row)

    if not http_df.empty:
        last_row = http_df.iloc[-1]
        http_data.append(last_row)

# Extracting relevant data for plotting
client_counts = np.arange(1, len(socket_data) + 1)
socket_sent = [entry["Bytes_Sent"] / 125000 for entry in socket_data]
socket_received = [entry["Bytes_Received"] / 125000 for entry in socket_data]
http_sent = [entry["Bytes_Sent"] / 125000 for entry in http_data]
http_received = [entry["Bytes_Received"] / 125000 for entry in http_data]

print(socket_sent)

# Plot
plt.figure(figsize=(10, 5))
plt.plot(client_counts, socket_sent, label="Socket sent", marker="o", linestyle="-")
plt.plot(client_counts, socket_received, label="Socket received", marker="o", linestyle="-")
plt.plot(client_counts, http_sent, label="HTTP sent", marker="o", linestyle="-")
plt.plot(client_counts, http_received, label="HTTP received", marker="o", linestyle="-")

# Labels and legend
plt.xlabel("Client Count")
plt.ylabel("Mbps")
plt.title("Client network I/O: Socket vs HTTP")
plt.legend()
plt.grid(True)

plt.savefig("performance_tests_client_network_usage.png")
plt.show()
