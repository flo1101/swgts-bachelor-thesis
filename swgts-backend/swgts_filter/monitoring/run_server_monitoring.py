import csv
import os
import signal
import sys
import time

import psutil

OUTPUT_FILE = "/monitoring/server_cpu_usage.csv"


def get_cpu_usage(interval):
    try:
        return psutil.cpu_times_percent(interval=interval, percpu=False)
    except Exception as e:
        print(f"Error getting CPU usage: {e}")
        return None


def monitor_cpu_usage(interval=1.0, duration=7200):
    print(f"Start monitoring CPU usage of server. Interval = {interval}")
    start_time = time.time()
    monitoring_data = []

    # Save monitored data on termination
    def handle_signal_interrupt(sig, frame):
        print(f"Signal {sig}. Saving data to disk...")
        save_monitoring_data(monitoring_data)
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal_interrupt)
    signal.signal(signal.SIGTERM, handle_signal_interrupt)

    try:
        while time.time() < start_time + duration:
            cpu_percent = get_cpu_usage(interval)
            if cpu_percent is not None:
                monitoring_data.append([time.time()] + list(cpu_percent))
        save_monitoring_data(monitoring_data)
    except KeyboardInterrupt:
        save_monitoring_data(monitoring_data)


def save_monitoring_data(data):
    print("Saving server monitoring data ...")
    directory = os.path.dirname(OUTPUT_FILE)
    if not os.path.exists(directory):
        os.makedirs(directory)

    fieldnames = ['Timestamp'] + list(psutil.cpu_times_percent(percpu=False)._fields)

    with open(OUTPUT_FILE, 'w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(fieldnames)
        writer.writerows(data)
    print(f"Wrote server monitoring data to {OUTPUT_FILE}")


if __name__ == "__main__":
    monitor_cpu_usage(interval=1.0)
