import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Load data from CSV files
http_file_path = "http/http_upload_performance_clients.csv"
socket_file_path = "socket/socket_upload_performance_clients.csv"

df_http = pd.read_csv(http_file_path, sep=",")
df_socket = pd.read_csv(socket_file_path, sep=",")

# Group results by client count and get average performance per group
http_grouped_by_client_count = df_http.groupby("Client Count")
socket_grouped_by_client_count = df_socket.groupby("Client Count")

http_avg_group_upload_times = http_grouped_by_client_count["Average Upload Time (s)"].mean()
socket_avg_group_upload_times = socket_grouped_by_client_count["Average Upload Time (s)"].mean()

# Get client counts (groups)
client_counts = http_avg_group_upload_times.index

# Setup plot
bar_width = 0.35
x = np.arange(len(client_counts))

# Plot the data
plt.figure(figsize=(10, 6))

http_bars = plt.bar(x - bar_width / 2, http_avg_group_upload_times, width=bar_width, label="HTTP")
socket_bars = plt.bar(x + bar_width / 2, socket_avg_group_upload_times, width=bar_width, label="Socket")

# Add values to the bars
for bar in http_bars:
    y_val = bar.get_height()
    plt.text(bar.get_x() + bar.get_width() / 2, y_val, round(y_val, 2), ha='center', va='bottom')

for bar in socket_bars:
    y_val = bar.get_height()
    plt.text(bar.get_x() + bar.get_width() / 2, y_val, round(y_val, 2), ha='center', va='bottom')

plt.xticks(x, client_counts)
plt.xlabel("Number of clients")
plt.ylabel("Average upload time (s)")
plt.title("Comparison of HTTP and socket upload performance for different number of clients")
plt.legend()
plt.grid(axis='y', linestyle='--', alpha=0.7)

# Save the plot
plt.savefig("upload_performance_comparison_clients.png")

# Show the plot
plt.show()
