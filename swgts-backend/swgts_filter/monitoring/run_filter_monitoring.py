import csv
import os
import signal
import subprocess
import sys
import time

import psutil

OUTPUT_FILE = "/monitoring/filter_cpu_usage.csv"


def get_docker_container_pid(container_name):
    try:
        print(f"CONTAINER NAME: {container_name}")
        command = f"docker inspect --format '{{{{.State.Pid}}}}' {container_name}"
        process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        print(f"STDOUT: {stdout.decode().strip()}")
        print(f"STDERR: {stderr.decode().strip()}")
        pid = int(stdout.decode().strip())
        return pid
    except Exception as e:
        print(f"Error getting Docker container PID for {container_name}: {e}")
        return None


def get_process_cpu_usage(pid, interval):
    try:
        process = psutil.Process(pid)
        return process.cpu_percent(interval=interval)
    except psutil.NoSuchProcess:
        print(f"Process with PID {pid} not found.")
        return None
    except Exception as e:
        print(f"Error getting CPU usage: {e}")
        return None


def monitor_docker_cpu(container_name, interval=1.0, duration=7200):
    pid = get_docker_container_pid(container_name)
    if pid is None:
        return

    start_time = time.time()
    monitoring_data = []

    def handle_termination(sig, frame):
        print("Application terminated, saving monitoring data...")
        save_monitoring_data(monitoring_data)
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_termination)

    try:
        while time.time() < start_time + duration:
            cpu_percent = get_process_cpu_usage(pid, interval)
            if cpu_percent is not None:
                monitoring_data.append((time.time(), cpu_percent))
            time.sleep(interval)
        save_monitoring_data(monitoring_data)
    except KeyboardInterrupt:
        save_monitoring_data(monitoring_data)


def save_monitoring_data(data):
    directory = os.path.dirname(OUTPUT_FILE)
    if not os.path.exists(directory):
        os.makedirs(directory)

    with open(OUTPUT_FILE, 'w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(['Timestamp', 'CPU_Percentage'])
        writer.writerows(data)
    print(f"Wrote filter monitoring data to {OUTPUT_FILE}")


if __name__ == "__main__":
    container_name = os.environ.get("HOSTNAME")
    monitor_docker_cpu(container_name, 1)
