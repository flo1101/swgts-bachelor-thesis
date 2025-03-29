import csv
import os
import signal
import sys
import time

OUTPUT_FILE = "/monitoring/api_cpu_usage.csv"
# cgroup file that tracks CPU usage
CGROUP_CPU_STAT = "/sys/fs/cgroup/cpu.stat"


def get_container_cpu_usage(interval):
    """Returns the CPU usage of the docker container in percent"""
    try:
        # Get time and CPU usage at interval start
        with open(CGROUP_CPU_STAT, "r") as f:
            stats_start = {line.split()[0]: int(line.split()[1]) for line in f.readlines()}

        system_time_start = time.time()
        usage_start = stats_start.get("usage_usec", 0)
        user_start = stats_start.get("user_usec", 0)
        system_start = stats_start.get("system_usec", 0)

        time.sleep(interval)

        # Get time and CPU usage at interval end
        with open(CGROUP_CPU_STAT, "r") as f:
            stats_end = {line.split()[0]: int(line.split()[1]) for line in f.readlines()}

        system_time_end = time.time()
        usage_end = stats_end.get("usage_usec", 0)
        user_end = stats_end.get("user_usec", 0)
        system_end = stats_end.get("system_usec", 0)

        # Compute CPU usage during interval in percent
        total_diff_usage = usage_end - usage_start
        user_diff = user_end - user_start
        system_diff = system_end - system_start
        diff_time = (system_time_end - system_time_start) * 1e6  # Convert seconds to microseconds

        cpu_percent = (total_diff_usage / diff_time) * 100
        user_percent = (user_diff / diff_time) * 100
        system_percent = (system_diff / diff_time) * 100

        return {
            'timestamp': system_time_end,
            'total_usage': cpu_percent,
            'user_usage': user_percent,
            'system_usage': system_percent
        }
    except Exception as e:
        print(f"Error getting containers CPU usage: {e}")
        return None


def monitor_docker_cpu(interval=1.0, duration=7200):
    print(f"Start monitoring CPU usage of API-container. Interval = {interval}")
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
            cpu_data = get_container_cpu_usage(interval)
            if cpu_data is not None:
                monitoring_data.append(
                    [cpu_data['timestamp'], cpu_data['total_usage'], cpu_data['user_usage'], cpu_data['system_usage']])
        save_monitoring_data(monitoring_data)
    except KeyboardInterrupt:
        save_monitoring_data(monitoring_data)


def save_monitoring_data(data):
    print("Saving API monitoring data ...")
    directory = os.path.dirname(OUTPUT_FILE)
    if not os.path.exists(directory):
        os.makedirs(directory)

    fieldnames = ['Timestamp', 'Total_CPU_Usage (%)', 'User_CPU_Usage (%)', 'System_CPU_Usage (%)']

    with open(OUTPUT_FILE, 'w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(fieldnames)
        writer.writerows(data)
    print(f"Wrote API monitoring data to {OUTPUT_FILE}")


if __name__ == "__main__":
    monitor_docker_cpu(interval=1.0)
