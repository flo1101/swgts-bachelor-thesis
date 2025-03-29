import csv
import os
import signal
import sys
import time

OUTPUT_FILE = "/monitoring/filter_cpu_usage.csv"
# cgroup files that track CPU usage
CGROUP_CPU_USAGE = "/sys/fs/cgroup/cpu/cpuacct.usage"
CGROUP_CPU_STAT = "/sys/fs/cgroup/cpu/cpu.stat"


def get_container_cpu_usage(interval):
    """Returns the CPU usage of the docker container in percent"""
    try:
        # Get time and CPU usage at interval start
        with open(CGROUP_CPU_USAGE, "r") as f:
            total_usage_start = int(f.read().strip())
        system_time_start = time.time()

        time.sleep(interval)

        # Get time and CPU usage at interval end
        with open(CGROUP_CPU_USAGE, "r") as f:
            total_usage_end = int(f.read().strip())
        system_time_end = time.time()

        # Compute CPU usage percentage
        diff_usage = total_usage_end - total_usage_start
        diff_time = (system_time_end - system_time_start) * 1e9  # Convert to nanoseconds
        return (diff_usage / diff_time) * 100
    except Exception as e:
        print(f"Error getting containers CPU usage: {e}")
        return None


def monitor_docker_cpu(interval=1.0, duration=7200):
    print(f"Start monitoring CPU usage of filter-container. Interval = {interval}")
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
            cpu_percent = get_container_cpu_usage(interval)
            if cpu_percent is not None:
                monitoring_data.append([time.time(), cpu_percent])
        save_monitoring_data(monitoring_data)
    except KeyboardInterrupt:
        save_monitoring_data(monitoring_data)


def save_monitoring_data(data):
    print("Saving filter monitoring data ...")
    directory = os.path.dirname(OUTPUT_FILE)
    if not os.path.exists(directory):
        os.makedirs(directory)

    fieldnames = ['Timestamp'] + ['CPU_Usage (%)']

    with open(OUTPUT_FILE, 'w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(fieldnames)
        writer.writerows(data)
    print(f"Wrote filter monitoring data to {OUTPUT_FILE}")


if __name__ == "__main__":
    monitor_docker_cpu(interval=1.0)
