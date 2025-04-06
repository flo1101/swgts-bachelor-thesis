import argparse
import os
import subprocess
import threading
import time

import pandas as pd
import psutil


def monitor_resources(process, cpu_percentages, network_stats, timestamps):
    """Monitors client CPU usage and network output"""
    try:
        while process.poll() is None:
            # Measure system-wide cpu usage in percent. Returned value is snapshot of current usage.
            cpu_percentages.append(psutil.cpu_percent(interval=None))
            # Measures network-usage (e.g. sent bytes, received bytes). Returned values are cumulative network statistics measured since system start.
            net = psutil.net_io_counters()
            network_stats.append((net.bytes_sent, net.bytes_recv))
            # Save timestamp
            timestamps.append(time.time())
            time.sleep(0.5)  # interval in which cpu and network usage gets measured
    except Exception as e:
        print(f"Error while monitoring: {e}")


def run_playwright_test(workers, mode):
    """Runs Playwright tests and monitors resources using passed upload mode"""

    if workers <= 0 or (mode != "http" and mode != "socket"):
        print(f"Error executing Playwright test: Invalid values for arguments passed")

    os.environ["CLIENT_COUNT"] = str(workers)
    command = [
        "npx",
        "playwright",
        "test",
        f"tests/{mode}-upload-parallel.spec.js",
        "--workers",
        str(workers),
    ]

    try:
        cpu_percentages = []
        network_stats = []
        timestamps = []

        process = subprocess.Popen(command)
        monitoring_thread = threading.Thread(target=monitor_resources,
                                             args=(process, cpu_percentages, network_stats, timestamps))
        monitoring_thread.start()

        process.wait()  # Wait for the Playwright test to finish.
        monitoring_thread.join()  # Wait for the monitoring thread to finish.

        if process.returncode == 0:
            print(f"Playwright {mode} test executed successfully with {workers} workers.")

            # Calculate average bytes sent/received per time interval in bytes per second
            bytes_sent_per_sec = []
            bytes_recv_per_sec = []

            for i in range(1, len(network_stats)):
                time_diff = timestamps[i] - timestamps[i - 1]
                if time_diff > 0:
                    bytes_sent = network_stats[i][0] - network_stats[i - 1][0]
                    bytes_recv = network_stats[i][1] - network_stats[i - 1][1]
                    bytes_sent_per_sec.append(bytes_sent / time_diff)
                    bytes_recv_per_sec.append(bytes_recv / time_diff)

            # Calculate average measurements for whole test
            avg_cpu_usage = sum(cpu_percentages) / len(cpu_percentages)
            avg_sent_per_second = sum(bytes_sent_per_sec) / len(bytes_sent_per_sec)
            avg_recv_per_second = sum(bytes_recv_per_sec) / len(bytes_recv_per_sec)

            print(f"Average CPU usage: {avg_cpu_usage} %")
            print(f"Average bytes sent per second: {avg_sent_per_second} b/s")
            print(f"Average bytes received per second: {avg_recv_per_second} b/s")

            # Save monitored values to CSV.
            # Each entry represents measurements taken at Timestamp.
            # CPU_Percentage is the average CPU usage in percent at that time.
            # Bytes_Sent and Bytes_Received are averaged values taken over the interval between the previous and current timestamp.
            # Additionally the last entry with timestamp -1 stores the average of all entries.
            output_file = f"monitoring/{mode}/upload_test_monitoring_{mode}_{workers}.csv"
            measurements = pd.DataFrame({
                "Timestamp": timestamps[1:] + [-1],
                "CPU_Percentage": cpu_percentages[1:] + [avg_cpu_usage],
                "Bytes_Sent": bytes_sent_per_sec + [avg_sent_per_second],
                "Bytes_Received": bytes_recv_per_sec + [avg_recv_per_second],
            })
            measurements.to_csv(output_file, index=False)
            print(f"Monitored data saved to {output_file}")
        else:
            print(f"Error executing Playwright {mode} test: {process.returncode}")

    except FileNotFoundError:
        print("Error: npx or playwright not found.")


if __name__ == "__main__":
    """
    Runs upload tests using the upload mode passed through --mode. 
    Tests are executed for all client counts up to the number passed through --workers.
    """
    parser = argparse.ArgumentParser(description="Run Playwright tests for multiple client and specified upload mode.")
    parser.add_argument("--workers", type=int, default=1, required=False, help="Number of workers to use.")
    parser.add_argument("--mode", type=str, default="socket", required=False,
                        help="Upload implementation to test performance of.")
    args = parser.parse_args()

    if args.mode == "socket":
        for workers in range(1, args.workers + 1):
            run_playwright_test(workers, "socket")

    elif args.mode == "http":
        for workers in range(1, args.workers + 1):
            run_playwright_test(workers, "http")
