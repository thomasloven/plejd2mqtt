# Plejd2MQTT
A docker container that works as a translator between [Home Assistant](https://home-assistant.io) and [Plejd](https://www.plejd.com) devices via MQTT.

This is just a standalone variant of [hassio-plejd](https://github.com/icanos/hassio-plejd/tree/master/plejd) which can be run in a separate container and doesn't need the Home Assistant supervisor.

I've removed some dead code and added availability tracking. I.e. lights will become unavailable when the container stops.


**Note that I have not tested all the functionality.
This is provided as-is.**

## Usage

Configuration is done via environment variables

Parameter | Description
--- | ---
`PLEJD_SITE` | The name of your site in the Plejd app
`PLEJD_USERNAME` | Your Plejd app username
`PLEJD_PASSWORD` | Your Plejd app password
`MQTT_BROKER` | MQTT broker URI. (default: `mqtt://localhost`)
`MQTT_USERNAME` | MQTT broker username
`MQTT_PASSWORD` | MQTT broker password
`PLEJD_INCLUDE_ROOMS_AS_LIGHT` | (default `false`)
`BLUETOOTH_TIMEOUT` | (default `2`)
`BLUETOOTH_WAIT` | (default `400`)

The Plejd2MQTT container requires access to `/var/run/dbus` for bluetooth access.


## Example docker-compose file:

```yaml
version: "3"

services:
  mqtt:
    image: eclipse-mosquitto:latest


  plejd2mqtt:
    image: thomasloven/plejd2mqtt
    volumes:
      - /var/run/dbus:/var/run/dbus
    environment:
      PLEJD_SITE: My Home
      PLEJD_USERNAME: me@example.com
      PLEJD_PASSWORD: ${MY_PLEJD_PASSWORD}
      MQTT_BROKER: mqtt://mqtt

```