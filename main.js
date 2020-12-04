const api = require('./api');
const mqtt = require('./mqtt');
const fs = require('fs');
const PlejdService = require('./ble.bluez');
const SceneManager = require('./scene.manager');

const version = "0.4.7";

async function main() {
  console.log('starting Plejd add-on v. ' + version);

  // const rawData = fs.readFileSync('/data/plejd.json');
  // const config = JSON.parse(rawData);

  const config = {
    site: process.env.PLEJD_SITE || "Default Site",
    username: process.env.PLEJD_USERNAME || "",
    password: process.env.PLEJD_PASSWORD || "",
    mqttBroker: process.env.MQTT_BROKER || "mqtt://localhost",
    mqttUsername: process.env.MQTT_USERNAME || "",
    mqttPassword: process.env.MQTT_PASSWORD || "",
    includeRoomsAsLights: process.env.PLEJD_INCLUDE_ROOMS_AS_LIGHTS || false,
    connectionTimeout: process.env.BLUETOOTH_TIMEOUT || 2,
    writeQueueWaitTime: process.env.BLUETOOTH_WAIT || 400,
  }

  if (!config.connectionTimeout) {
    config.connectionTimeout = 2;
  }

  const plejdApi = new api.PlejdApi(config.site, config.username, config.password);
  const client = new mqtt.MqttClient(config.mqttBroker, config.mqttUsername, config.mqttPassword);

  ['SIGINT', 'SIGHUP', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      console.log(`Received ${signal}. Cleaning up.`);
      client.disconnect(() => process.exit(0));
    });
  });

  plejdApi.login().then(() => {
    // load all sites and find the one that we want (from config)
    plejdApi.getSites().then((site) => {
      // load the site and retrieve the crypto key
      plejdApi.getSite(site.site.siteId).then((cryptoKey) => {
        // parse all devices from the API
        const devices = plejdApi.getDevices();

        client.on('connected', () => {
          console.log('plejd-mqtt: connected to mqtt.');
          client.discover(devices);
        });

        client.init();

        // init the BLE interface
        const sceneManager = new SceneManager(plejdApi.site, devices);
        const plejd = new PlejdService(cryptoKey, devices, sceneManager, config.connectionTimeout, config.writeQueueWaitTime, true);
        plejd.on('connectFailed', () => {
          console.log('plejd-ble: were unable to connect, will retry connection in 10 seconds.');
          setTimeout(() => {
            plejd.init();
          }, 10000);
        });

        plejd.init();

        plejd.on('authenticated', () => {
          console.log('plejd: connected via bluetooth.');
        });

        // subscribe to changes from Plejd
        plejd.on('stateChanged', (deviceId, command) => {
          client.updateState(deviceId, command);
        });

        plejd.on('sceneTriggered', (deviceId, scene) => {
          client.sceneTriggered(scene);
        });

        // subscribe to changes from HA
        client.on('stateChanged', (device, command) => {
          const deviceId = device.id;

          if (device.typeName === 'Scene') {
            // we're triggering a scene, lets do that and jump out.
            // since scenes aren't "real" devices.
            plejd.triggerScene(device.id);
            return;
          }

          let state = 'OFF';
          let commandObj = {};

          if (typeof command === 'string') {
            // switch command
            state = command;
            commandObj = {
              state: state
            };

            // since the switch doesn't get any updates on whether it's on or not,
            // we fake this by directly send the updateState back to HA in order for
            // it to change state.
            client.updateState(deviceId, {
              state: state === 'ON' ? 1 : 0
            });
          } else {
            state = command.state;
            commandObj = command;
          }

          if (state === 'ON') {
            plejd.turnOn(deviceId, commandObj);
          } else {
            plejd.turnOff(deviceId, commandObj);
          }
        });

        client.on('settingsChanged', (settings) => {
          if (settings.module === 'mqtt') {
            client.updateSettings(settings);
          } else if (settings.module === 'ble') {
            plejd.updateSettings(settings);
          } else if (settings.module === 'api') {
            plejdApi.updateSettings(settings);
          }
        });
      });
    });
  });
}

main();
