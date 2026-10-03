# Launch Monitor Connection & Integration Guide

The OpenGolfSim Arcade launcher includes built-in TCP servers that bridge real-world launch monitors directly into the game without requiring third-party subscription software.

---

## 1. Supported Ports & Protocols

| Port | Protocol | Typical Clients | Description |
| :--- | :--- | :--- | :--- |
| **`9210`** | **GSPro OpenAPI v1/v2** | Garmin R10 (Springbok / MuniGolf), Rapsodo MLM2PRO, FlightScope, Uneekor | Standard TCP socket streaming JSON ball & club data |
| **`3111`** | **OGS Developer API** | Custom scripts, Python simulators, Bluetooth daemons | Line-delimited JSON shot injection |

---

## 2. Garmin Approach R10 Setup

The Garmin Approach R10 connects via Bluetooth Low Energy (BLE) to a connector program (such as **Springbok Connector**, **MLM2PRO-GSPro-Connector**, or **MuniGolf**), which then forwards shots over TCP to port `9210`.

### Configuration Steps:
1. Ensure your PC running OpenGolfSim Arcade and the device running your connector are on the same local network (Wi-Fi or Ethernet).
2. Set the target IP in your connector's settings:
   * **Target IP**: IP address of your OpenGolfSim machine (e.g., `192.168.1.154` or `127.0.0.1` if running locally).
   * **Target Port**: `9210`
3. Launch OpenGolfSim Arcade.
4. When the connector connects, you will see in the launcher console:
   ```
   [GSPro-Bridge] Launch Monitor connected from 192.168.1.xxx:xxxxx
   ```
   And the top status pill in the Arcade Hub will turn green:
   `LAUNCH MONITOR CONNECTED`

---

## 3. GSPro OpenAPI Protocol Specification (Port 9210)

### 3.1 Initial Handshake
Upon client connection, the Arcade TCP server automatically sends a connection acknowledgement:
```json
{
  "Code": 201,
  "Message": "GSPro Connect Successful",
  "Player": {
    "Handed": "RH",
    "Club": "DR"
  }
}
```

### 3.2 Shot Data Payload
When a swing is detected, the connector sends a JSON payload containing `BallData`:
```json
{
  "DeviceID": "Garmin-R10",
  "Units": "Yards",
  "ShotNumber": 42,
  "BallData": {
    "Speed": 112.5,
    "SpinAxis": -3.2,
    "TotalSpin": 2850,
    "Backspin": 2840,
    "SideSpin": -160,
    "HLA": -2.8,
    "VLA": 14.1
  },
  "ClubData": {
    "Speed": 85.2,
    "Path": 1.2
  }
}
```

### 3.3 Server Acknowledgement
The arcade launcher responds immediately with:
```json
{
  "Code": 200,
  "Message": "Shot received successfully"
}
```

### 3.4 Inverted Coordinate Mapping
As detailed in the [Developer Guide](DEVELOPER_GUIDE.md), the launcher automatically maps:
```javascript
const hla = -(Number(b.HLA) || 0);
const spinAxis = -(Number(b.SpinAxis) || 0);
```
So pull shots ($HLA < 0$) and draws ($SpinAxis < 0$) curve and launch left in the 3D world as expected.

---

## 4. Developer API Protocol (Port 3111)

For developers building custom launch monitor drivers or automated testing scripts, port `3111` accepts newline-terminated JSON:

```json
{"type":"shot","shot":{"ballSpeed":85,"verticalLaunchAngle":28,"horizontalLaunchAngle":0,"totalSpin":6500,"spinAxis":0}}
```

### Quick Test via Python:
```python
import socket
import json

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(('127.0.0.1', 3111))
payload = {
    "type": "shot",
    "shot": {
        "ballSpeed": 65.0,
        "verticalLaunchAngle": 32.0,
        "horizontalLaunchAngle": -2.5,
        "totalSpin": 7200,
        "spinAxis": -5.0
    }
}
s.sendall((json.dumps(payload) + '\n').encode('utf-8'))
s.close()
```
