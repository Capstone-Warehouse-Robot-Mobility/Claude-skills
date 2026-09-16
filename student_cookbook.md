# FRR Development And Topotest Reference Guide

This guide provides a repeatable university lab workflow for building FRRouting (FRR), running topotests, and analyzing EVPN host mobility experiments.

Supported platforms:

- macOS using Colima and the Docker CLI
- PC running Ubuntu 22.04 LTS or Ubuntu 24.04 LTS

All commands are intended for a terminal. Commands marked "inside the container" must be run after entering the FRR development container.

## 1. Platform Setup

Choose the setup that matches your computer.

### 1.1 macOS With Colima

Colima provides the Linux virtual machine needed to run Docker containers on macOS.

Install Homebrew if it is not already installed:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Install Colima, Docker CLI, Git, and Wireshark:

```bash
brew install colima docker git
brew install --cask wireshark
```

Start Colima with enough resources for FRR topotests:

```bash
colima start --cpu 4 --memory 8 --disk 60
```

Verify Docker works:

```bash
docker run hello-world
```

Verify that the Colima Linux VM exposes kernel modules to Docker:

```bash
docker run --rm --privileged -v /lib/modules:/lib/modules ubuntu:22.04 bash -lc 'test -d /lib/modules && ls /lib/modules'
```

Expected result: the command prints at least one kernel module directory. If it prints nothing or reports that `/lib/modules` is missing, stop and restart Colima:

```bash
colima stop
colima start --cpu 4 --memory 8 --disk 60
```

Useful Colima commands:

```bash
colima status
colima stop
colima start
```

macOS notes:

- Keep the FRR workspace under your home directory, for example `~/src/frr`, so Colima can mount it into containers.
- If a web visualizer uses port `5000`, macOS AirPlay Receiver may already be using that port. Disable AirPlay Receiver or publish a different port.
- Packet captures copied out of the container can be opened with Wireshark on macOS.

### 1.2 PC With Ubuntu

Use Ubuntu 22.04 LTS or Ubuntu 24.04 LTS on the PC. A native install is preferred. An Ubuntu VM can also work if it has enough CPU, RAM, disk, and nested virtualization support.

Recommended resources:

| Resource | Recommended |
| --- | --- |
| RAM | 8 GB or more |
| CPU | 4 cores if available |
| Disk | 40 GB minimum, 60 GB preferred |

Update Ubuntu:

```bash
sudo apt update
sudo apt upgrade -y
```

Install required packages:

```bash
sudo DEBIAN_FRONTEND=noninteractive apt install -y git docker.io docker-buildx build-essential tmux python3-pytest python3-pip tcpdump tshark wireshark
```

Enable Docker:

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

Allow your user to run Docker:

```bash
sudo usermod -aG docker "$USER"
```

Reboot so the group change applies:

```bash
reboot
```

After reboot, verify Docker works:

```bash
docker run hello-world
```

If Docker reports a permission error after reboot, check group membership:

```bash
groups
```

The output should include `docker`.

## 2. Clone FRR

Run these commands on macOS or Ubuntu:

```bash
mkdir -p ~/src
cd ~/src
git clone https://github.com/FRRouting/frr.git
cd frr
```

Optional: use a course-assigned branch.

```bash
git branch -a
git checkout <branch-name>
```

For development work, create your own branch:

```bash
git checkout -b dev/<userid>.<short-description>
```

Example:

```bash
git checkout -b dev/student01.evpn_mobility
```

## 3. Build The FRR Development Image

Run from the FRR repository root:

```bash
cd ~/src/frr
```

Use Ubuntu 22.04 for the container image unless the course staff gives a different version:

```bash
docker build -t frr-dev:latest --build-arg=UBUNTU_VERSION=22.04 --build-arg=UID="$(id -u)" -f docker/ubuntu-ci/Dockerfile .
```

If your assigned FRR branch requires Ubuntu 20.04:

```bash
docker build -t frr-dev:latest --build-arg=UBUNTU_VERSION=20.04 --build-arg=UID="$(id -u)" -f docker/ubuntu-ci/Dockerfile .
```

Check that the image exists:

```bash
docker images | grep frr-dev
```

## 4. Create And Enter The FRR Development Container

Run from the FRR repository root:

```bash
cd ~/src/frr
```

Create the container:

```bash
docker run --init -it --privileged --name frr-dev -v /lib/modules:/lib/modules -v "$(pwd)":/home/frr/frr frr-dev:latest bash
```

If the visualizer will be used later, create the container with port `5000` published:

```bash
docker run --init -it --privileged -p 5000:5000 --name frr-dev -v /lib/modules:/lib/modules -v "$(pwd)":/home/frr/frr frr-dev:latest bash
```

Important: Docker ports are published when the container is created. If the container was created without `-p 5000:5000`, remove and recreate it before using the visualizer.

Expected result: the terminal is now inside the FRR development container.

If you exit the shell, the container stops. Start it again and open a fresh shell with:

```bash
docker start frr-dev
docker exec -it frr-dev bash
```

## 5. Build FRR Inside The Container

Run inside the container:

```bash
cd ~/frr
./bootstrap.sh
./configure \
  --prefix=/usr \
  --localstatedir=/var \
  --sbindir=/usr/lib/frr \
  --sysconfdir=/etc \
  --enable-vtysh \
  --enable-pimd \
  --enable-sharpd \
  --enable-multipath=256 \
  --enable-user=frr \
  --enable-group=frr \
  --enable-vty-group=frrvty \
  --enable-snmp=agentx \
  --enable-scripting \
  --with-pkg-extra-version=-my-manual-build
make -j"$(nproc)"
sudo make install
```

For debugging with `gdb`, add this option to the `./configure` command:

```bash
--enable-dev-build
```

Check the install:

```bash
vtysh --version
```

## 6. Container Management

Run these commands on the host terminal, not inside the container.

List running containers:

```bash
docker ps
```

List all containers:

```bash
docker ps -a
```

Start a stopped container:

```bash
docker start frr-dev
```

Open a new shell in a running container:

```bash
docker exec -it frr-dev bash
```

For normal lab work, use `docker exec -it frr-dev bash` each time you need a shell. This also allows multiple shells at the same time, which is useful when running the visualizer in one shell and tests in another.

Stop the container:

```bash
docker stop frr-dev
```

Remove the container:

```bash
docker rm -f frr-dev
```

Remove the image:

```bash
docker rmi frr-dev:latest
```

If Docker says the container name already exists, remove the old container or choose a new name.

## 7. Rebuild After Code Changes

Run inside the container:

```bash
cd ~/frr
make -j"$(nproc)"
sudo make install
```

Run unit tests:

```bash
make check
```

Rebuild the Docker image only when the Dockerfile or container dependencies change:

```bash
cd ~/src/frr
docker build -t frr-dev:latest --build-arg=UBUNTU_VERSION=22.04 --build-arg=UID="$(id -u)" -f docker/ubuntu-ci/Dockerfile .
```

## 8. Run FRR Topotests

Topotests must run inside the FRR development container.

Start and attach to the container:

```bash
cd ~/src/frr
docker start frr-dev
docker exec -it frr-dev bash
```

Start `tmux` for long-running or interactive tests:

```bash
tmux
```

Run one test directory:

```bash
cd /home/frr/frr/tests/topotests
sudo -E pytest -s <test-directory>
```

Run one test file:

```bash
cd /home/frr/frr/tests/topotests
sudo -E pytest -s <test-directory>/<test-file>.py
```

Run all topotests:

```bash
cd /home/frr/frr/tests/topotests
sudo -E pytest -n"$(nproc)" --dist=loadfile
```

The full topotest suite can take a long time and may require more resources than a small laptop or VM provides.

## 9. Useful Topotest Options

Build the topology without running assertions:

```bash
sudo -E pytest --topology-only <test-directory>/<test-file>.py
```

Capture packets on all supported interfaces:

```bash
sudo -E pytest --pcap=all <test-directory>/<test-file>.py
```

Pause and open a VTYSH session for a router:

```bash
tmux
cd /home/frr/frr/tests/topotests
sudo -E pytest -s --pause --vtysh=<router-name> <test-directory>
```

Pause on failure and open VTYSH:

```bash
cd /home/frr/frr/tests/topotests
sudo -E pytest --vtysh-on-error <test-directory>
```

Detach from tmux:

```text
Ctrl+b, then d
```

Reattach to tmux:

```bash
tmux attach
```

## 10. Install Missing Packages Inside The Container

Install `tcpdump` if packet capture commands fail:

```bash
sudo -E apt-get update
sudo -E apt-get install -y tcpdump
```

Install visualizer dependencies if needed:

```bash
python3 -m pip install --user flask flask-socketio requests
```

Use this pattern for other packages:

```bash
sudo -E apt-get install -y <package-name>
```

## 11. Copy Packet Captures Out Of The Container

Topotest results are normally written under `/tmp/topotests` inside the container.

Create a capture folder on the host:

```bash
mkdir -p ~/mycaptures
```

Copy all topotest results out of the container:

```bash
docker cp frr-dev:/tmp/topotests ~/mycaptures/
```

Copy one specific capture:

```bash
docker cp frr-dev:/tmp/topotests/<test-run>/<node>/<file>.pcap ~/mycaptures/
```

Open `.pcap` files with Wireshark.

## Appendix A. Host Mobility Project

The remaining project sections are an appendix to the main FRR cookbook. They are specific to the course Host Mobility project and are not required for a basic FRR workspace, build, or general topotest workflow.

### A.1 EVPN Host Mobility Experiment

This section describes the course EVPN host mobility tests. The tests simulate endpoints moving between VTEPs while keeping the same MAC and IP address.

The simulation uses Linux MACVLAN interfaces:

1. A mobile endpoint is created on one host.
2. The attached VTEP learns the endpoint MAC/IP.
3. The VTEP advertises the endpoint through BGP EVPN.
4. The endpoint interface is deleted from the original host.
5. The same MAC/IP is recreated on another host.
6. The new VTEP advertises the move through BGP EVPN.
7. Other VTEPs update their forwarding state.

Course test directories:

```text
tests/topotests/bgp_evpn_capstone/
tests/topotests/bgp_evpn_capstone_asym/
```

The base mobility test uses an EVPN fabric where mobile endpoints can move among eligible VTEPs.

The asymmetric mobility test models a hub-and-spoke EVPN control plane:

- `vtep1` is the hub/controller-side VTEP.
- `vtep2..vtep7` are spokes.
- The hub imports spoke routes.
- Spokes import hub routes.
- Spokes should not import each other's EVPN routes.

### A.2 Add Course Mobility Tests To FRR

If the course test directories are distributed separately, copy them into your FRR checkout on the host:

```bash
cp -R <course-files>/bgp_evpn_capstone ~/src/frr/tests/topotests/
cp -R <course-files>/bgp_evpn_capstone_asym ~/src/frr/tests/topotests/
```

Then attach to the container:

```bash
cd ~/src/frr
docker start frr-dev
docker exec -it frr-dev bash
```

Confirm the directories are visible inside the container:

```bash
ls ~/frr/tests/topotests/bgp_evpn_capstone
ls ~/frr/tests/topotests/bgp_evpn_capstone_asym
```

### A.3 Run The Base Mobility Test

Run inside the container from the FRR repository root:

```bash
cd ~/frr
PYTEST_XDIST_MODE=no python3 -m pytest -s tests/topotests/bgp_evpn_capstone/test_evpn_capstone.py::test_mobility
```

Repeat the full migration sequence three times:

```bash
PYTEST_XDIST_MODE=no MIGRATION_REPEAT_COUNT=3 python3 -m pytest -s tests/topotests/bgp_evpn_capstone/test_evpn_capstone.py::test_mobility
```

Move endpoints in batches of 8:

```bash
PYTEST_XDIST_MODE=no MIGRATION_BATCH_SIZE=8 python3 -m pytest -s tests/topotests/bgp_evpn_capstone/test_evpn_capstone.py::test_mobility
```

Increase the duplicate-MAC overlap window:

```bash
PYTEST_XDIST_MODE=no MOBILITY_OVERLAP_SECONDS=1.0 python3 -m pytest -s tests/topotests/bgp_evpn_capstone/test_evpn_capstone.py::test_mobility
```

Enter `munet>` CLI at the end of the test:

```bash
PYTEST_XDIST_MODE=no MUNET_CLI=1 MIGRATION_REPEAT_COUNT=2 python3 -m pytest -s tests/topotests/bgp_evpn_capstone/test_evpn_capstone.py::test_mobility
```

### A.4 Run The Asymmetric Mobility Test

Run inside the container from the FRR repository root:

```bash
cd ~/frr
PYTEST_XDIST_MODE=no python3 -m pytest -s tests/topotests/bgp_evpn_capstone_asym/test_evpn_capstone_asym.py::test_mobility
```

Repeat the migration sequence three times:

```bash
PYTEST_XDIST_MODE=no MIGRATION_REPEAT_COUNT=3 python3 -m pytest -s tests/topotests/bgp_evpn_capstone_asym/test_evpn_capstone_asym.py::test_mobility
```

Stress-style example:

```bash
PYTEST_XDIST_MODE=no MIGRATION_REPEAT_COUNT=5 MIGRATION_BATCH_SIZE=16 MIGRATION_BATCH_SETTLE_SECONDS=0.05 python3 -m pytest -s tests/topotests/bgp_evpn_capstone_asym/test_evpn_capstone_asym.py::test_mobility
```

### A.5 Mobility Test Environment Variables

| Variable | Meaning |
| --- | --- |
| `NUM_MOBILE_VMS` | Number of mobile VM endpoints |
| `MIGRATION_REPEAT_COUNT` | Number of full migration rounds |
| `MIGRATION_BATCH_SIZE` | Number of VMs moved per batch |
| `MIGRATION_BATCH_SETTLE_SECONDS` | Delay between migration batches |
| `MOBILITY_OVERLAP_SECONDS` | Time both old and new MACVLAN endpoints can overlap |
| `ENABLE_MIGRATION_BATCH_SAFETY_ROLLBACK` | Enables rollback if destination creation fails |
| `MUNET_CLI` | Set to `1` to enter `munet>` CLI at test end |

Invalid numeric values fall back to defaults defined in the test code.

### A.6 Mobility Packet Capture Analysis

The mobility tests save BGP packet captures under `/tmp/topotests`.

Typical capture path:

```text
/tmp/topotests/bgp_evpn_capstone.test_evpn_capstone/<node>/<node>_evpn_mobility.pcap
```

Copy a capture out of the container:

```bash
docker cp frr-dev:/tmp/topotests/bgp_evpn_capstone.test_evpn_capstone/spine1/spine1_evpn_mobility.pcap ~/mycaptures/
```

Useful Wireshark filters:

| Filter | Meaning |
| --- | --- |
| `bgp.type == 2` | All BGP UPDATE messages |
| `bgp.update.path_attribute.type_code == 14` | UPDATEs with `MP_REACH_NLRI` |
| `bgp.update.path_attribute.type_code == 15` | UPDATEs with `MP_UNREACH_NLRI` |

Example MAC-specific filter:

```text
bgp.type == 2 && (
  bgp.evpn.nlri.mac_addr == 00:00:00:00:00:01 ||
  bgp.evpn.nlri.mac_addr == 00:00:00:00:00:02 ||
  bgp.evpn.nlri.mac_addr == 00:00:00:00:00:03 ||
  bgp.evpn.nlri.mac_addr == 00:00:00:00:00:04
)
```

For a graph in Wireshark:

1. Open `Statistics > I/O Graphs`.
2. Add the display filter.
3. Set style to `Line`.
4. Set Y Axis to `COUNT FIELDS(Y Field)`.
5. Set Y Field to `bgp.type`.
6. Adjust the interval for the time scale required by the lab.

### A.7 Visualizer

The visualizer is a Flask server that runs inside the FRR container and is viewed from the host browser.

The container must be created with port `5000` published:

```bash
docker rm -f frr-dev
docker run --init -it --privileged -p 5000:5000 --name frr-dev -v /lib/modules:/lib/modules -v "$(pwd)":/home/frr/frr frr-dev:latest bash
```

Inside the container:

```bash
python3 -m pip install --user flask flask-socketio requests
tmux new -s server
cd ~/frr/tests/topotests/bgp_evpn_capstone_asym
python3 visualizer_server.py
```

Open on the host:

```text
http://localhost:5000
```

Detach from the server session:

```text
Ctrl+b, then d
```

Run the asymmetric mobility test in another container shell. The visualizer should show topology and endpoint movement events.

Open the second container shell from the host with:

```bash
docker exec -it frr-dev bash
```

### A.8 Live Packet Chart

Start the visualizer server first:

```bash
cd ~/frr
python3 tests/topotests/bgp_evpn_capstone_asym/visualizer_server.py
```

Run the asymmetric test:

```bash
sudo -E pytest -s tests/topotests/bgp_evpn_capstone_asym/test_evpn_capstone_asym.py
```

Open:

```text
http://127.0.0.1:5000/packet-chart
```

Optional chart flags:

| Variable | Meaning |
| --- | --- |
| `ENABLE_LIVE_PACKET_GRAPH=true|false` | Enable or disable packet sampling events |
| `AUTO_OPEN_PACKET_CHART_WINDOW=true|false` | Enable or disable automatic browser pop-up |
| `AUTO_START_PACKET_CHART_SERVER=true|false` | Auto-start server if port 5000 is not already serving |
| `PACKET_SAMPLE_INTERVAL_SECONDS=<float>` | Sampling interval; default is `1.0`, minimum is `0.2` |
| `PACKET_CHART_URL=<url>` | Override chart URL; default is `/packet-chart` |

Example:

```bash
ENABLE_LIVE_PACKET_GRAPH=true AUTO_OPEN_PACKET_CHART_WINDOW=true PACKET_SAMPLE_INTERVAL_SECONDS=0.75 sudo -E pytest -s tests/topotests/bgp_evpn_capstone_asym/test_evpn_capstone_asym.py
```

### A.9 Asymmetric Test Interpretation

The asymmetric test is intended to validate hub-and-spoke route visibility.

Expected control-plane behavior:

- Hub-to-spoke EVPN routes are allowed.
- Spoke-to-hub EVPN routes are allowed.
- Spoke-to-spoke EVPN routes are filtered.

Do not rely only on ping success to prove that spoke-to-spoke control-plane isolation is correct. Linux bridge learning can sometimes learn data-plane MAC reachability through the hub. For policy validation, inspect:

```text
show bgp l2vpn evpn summary
show bgp l2vpn evpn route
show evpn mac vni 1000
show running-config
bridge fdb show
```

Useful validation order:

1. Confirm EVPN sessions are established.
2. Confirm route-map bindings on spine neighbors.
3. Confirm route-target import/export policy.
4. Confirm VTEP loopback reachability.
5. Confirm `advertise-all-vni` is present.
6. Compare EVPN routes with packet captures.

## 12. Troubleshooting

### Docker permission denied on Ubuntu

Add the user to the Docker group and reboot:

```bash
sudo usermod -aG docker "$USER"
reboot
```

### Docker cannot connect on macOS

Confirm Colima is running:

```bash
colima status
```

Start it if needed:

```bash
colima start --cpu 4 --memory 8 --disk 60
```

### Container name already exists

```bash
docker ps -a
docker rm -f frr-dev
```

### Container is stopped

```bash
docker start frr-dev
docker exec -it frr-dev bash
```

### Image cannot be removed

A container still depends on the image. Remove the container first:

```bash
docker ps -a
docker rm <container-name-or-id>
docker rmi frr-dev:latest
```

### Topotest interactive commands fail

Run the test inside `tmux`:

```bash
tmux
```

### Packet captures are missing

Install `tcpdump` inside the container:

```bash
sudo -E apt-get update
sudo -E apt-get install -y tcpdump
```

### Visualizer page does not load

Check that the container was created with `-p 5000:5000`:

```bash
docker ps
```

If the port is missing, remove and recreate the container with the port published.

On macOS, also check whether AirPlay Receiver is using port `5000`.

### Colima kernel module check fails

Restart Colima and rerun the check:

```bash
colima stop
colima start --cpu 4 --memory 8 --disk 60
docker run --rm --privileged -v /lib/modules:/lib/modules ubuntu:22.04 bash -lc 'test -d /lib/modules && ls /lib/modules'
```

If the check still fails, use the Ubuntu PC workflow or an Ubuntu VM for topotests that require loadable kernel modules.

## 13. Quick Command Reference

macOS setup:

```bash
brew install colima docker git
brew install --cask wireshark
colima start --cpu 4 --memory 8 --disk 60
docker run hello-world
```

Ubuntu setup:

```bash
sudo apt update
sudo apt upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt install -y git docker.io docker-buildx build-essential tmux python3-pytest python3-pip tcpdump tshark wireshark
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"
reboot
```

FRR clone and image build:

```bash
mkdir -p ~/src
cd ~/src
git clone https://github.com/FRRouting/frr.git
cd frr
docker build -t frr-dev:latest --build-arg=UBUNTU_VERSION=22.04 --build-arg=UID="$(id -u)" -f docker/ubuntu-ci/Dockerfile .
```

Container creation:

```bash
docker run --init -it --privileged --name frr-dev -v /lib/modules:/lib/modules -v "$(pwd)":/home/frr/frr frr-dev:latest bash
```

FRR build inside container:

```bash
cd ~/frr
./bootstrap.sh
./configure --prefix=/usr --localstatedir=/var --sbindir=/usr/lib/frr --sysconfdir=/etc --enable-vtysh --enable-pimd --enable-sharpd --enable-multipath=256 --enable-user=frr --enable-group=frr --enable-vty-group=frrvty --enable-snmp=agentx --enable-scripting --with-pkg-extra-version=-my-manual-build
make -j"$(nproc)"
sudo make install
```

Run a topotest:

```bash
cd /home/frr/frr/tests/topotests
sudo -E pytest -s <test-directory>/<test-file>.py
```

Copy results:

```bash
mkdir -p ~/mycaptures
docker cp frr-dev:/tmp/topotests ~/mycaptures/
```

## 14. Reference Links

- FRRouting repository: https://github.com/FRRouting/frr
- FRR Docker developer documentation: https://docs.frrouting.org/projects/dev-guide/en/latest/building-docker.html
- FRR topotests documentation: https://docs.frrouting.org/projects/dev-guide/en/latest/topotests.html
- Colima documentation: https://colima.run/
- Wireshark: https://www.wireshark.org/
