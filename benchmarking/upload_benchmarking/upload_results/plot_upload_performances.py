import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Load data from CSV files
http_file_path = "http/http_upload_performance.csv"
socket_file_path = "socket/socket_upload_performance.csv"

df_http = pd.read_csv(http_file_path, sep=",")
df_socket = pd.read_csv(socket_file_path, sep=",")

file_sizes = df_http["File Size (MB)"]
n = len(file_sizes)

bar_width = 0.35
x = np.arange(n)

# Plot the data
plt.figure(figsize=(10, 6))

http_bars = plt.bar(x - bar_width / 2, df_http["Average Upload Time (s)"], width=bar_width, label="HTTP")
socket_bars = plt.bar(x + bar_width / 2, df_socket["Average Upload Time (s)"], width=bar_width, label="Socket")

# Display values for bars
for bar in http_bars:
    y_val = bar.get_height()
    plt.text(bar.get_x() + bar.get_width() / 2, y_val, round(y_val, 2), ha='center', va='bottom')

for bar in socket_bars:
    y_val = bar.get_height()
    plt.text(bar.get_x() + bar.get_width() / 2, y_val, round(y_val, 2), ha='center', va='bottom')

plt.xticks(x, file_sizes)
plt.xlabel("File size (MB)")
plt.ylabel("Average upload time (s)")
plt.title("Comparison of HTTP and socket upload performance for different files sizes")
plt.legend()
plt.grid(axis='y', linestyle='--', alpha=0.7)

plt.savefig("upload_performance_comparison.png")
plt.show()
