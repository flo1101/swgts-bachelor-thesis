import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Load data from CSV files
http_file_path = "http_upload_performance.csv"
socket_file_path = "socket_upload_performance.csv"

df_http = pd.read_csv(http_file_path, sep=",")
df_socket = pd.read_csv(socket_file_path, sep=",")

file_sizes = df_http["File Size (MB)"]
n = len(file_sizes)

bar_width = 0.35
x = np.arange(n)

# Plot the data
plt.figure(figsize=(10, 6))

plt.bar(x - bar_width / 2, df_http["Average Upload Time (s)"], width=bar_width, label="HTTP")
plt.bar(x + bar_width / 2, df_socket["Average Upload Time (s)"], width=bar_width, label="Socket")

plt.xticks(x, file_sizes)
plt.xlabel("File Size (MB)")
plt.ylabel("Average Upload Time (s)")
plt.title("Comparison of HTTP and Socket Upload Performance")
plt.legend()
plt.grid(axis='y', linestyle='--', alpha=0.7)

# Save the plot
plt.savefig("upload_performance_comparison.png")

# Show the plot
plt.show()
