/**
 * JSON Message Switch
 * @author "0LEG0 <a.i.s@gmx.com>"
 * @version 1.0.1
 */
"use strict";

const { JEngine, JMessage } = require("jms-engine");
const path = require("path");
const minimist = require("minimist");

const ARGV = minimist(process.argv.slice(2)); 
let JENGINE = null;

/**
 * Command line options
 * -h Help message
 * -c Config file
 * -d JMS home dir
 * -l Log file //todo
 */
if (ARGV.h) {
    console.log("\nUsage: jms [options]\n\t\-h Help\n\t-c Full path to configuration file\n\t-d Path to jms home dir\n");
    process.exit(0);
}
const PATH = ARGV.d ?? path.dirname(__filename);
process.chdir(PATH);
process.env["NODE_PATH"] = (process.env["NODE_PATH"] ? ":" : process.env.PWD + "/node_modules:") + process.env.PWD;

/**
 * Default config options
 */
const CONFIG = {
    message_timeout: 4000,
    log_level: 2,
    load: []
}
const CONFIG_FILE = ARGV.c ?? (PATH + "/conf/.jms.js");

// console commands
const CMD = {
    HALT: /^halt$/,
    LIST: /^module list$/,
    LOAD: /^module load (.+)/,
    UNLOAD: /^module unload (.+)/,
    RELOAD: /^module reload (.+)/,
    HELP: /^(module.*|help module.*|help)$/,
    STATUS: /^status/
}

// jengine.command handler
async function commandHandler(m) {
    let line = m.get("line");
    if (!line) return m;
    switch (true) {
        case CMD.HALT.test(line):
            m.handled = true;
            m.result = "JSON Message Switch is shutting down...";
            stop();
            break;
        case CMD.STATUS.test(line):
            m.handled = true;
            m.result = await Promise.all(JENGINE.getModules()
                .filter(item => item)
                .map(item => item.dispatch(new JMessage("jengine.status", {}, false, false, 1000)).then(m => new Object({ module: item.name, status: m.result })).catch(() => {})))
            break;
        case CMD.LIST.test(line):
            m.handled = true;
            m.result = JENGINE.getModules()
                .filter(item => item)
                .map(item => {
                    return {
                            module: item.name,
                            timeout: item.timeout,
                            // handles: Object.entries(item.installs)
                            //     .map(i => i.join(":"))
                            //     .join(" ")
                        }
                    });
            break;
        case CMD.LOAD.test(line):
            m.handled = true;
            try {
                m.result = "Module " + (await JENGINE.load(CMD.LOAD.exec(line)[1])).name + " loaded.";
            } catch(err) {
                m.result = err.stack ? err.stack : err;
            }
            break;
        case CMD.UNLOAD.test(line):
            m.handled = true;
            try {
                m.result = await JENGINE.unload(CMD.UNLOAD.exec(line)[1]);
            } catch(err) {
                m.result = err.stack ? err.stack : err; 
            }
            break;
        case CMD.RELOAD.test(line):
            m.handled = true;
            let name = CMD.RELOAD.exec(line)[1];
            let module = JENGINE.getModules().find(i => i && i.name === name);
            if (module) {
                let filename = module.spawnargs[1];
                try {
                    await JENGINE.unload(module);
                    m.result = "Module " + (await JENGINE.load(filename)).name + " reloaded.";
                } catch(err) {
                    m.result = err.stack ? err.stack : err; 
                }
            } else {
                m.result = "Module " + name + " not found.";
            }
            break;
        case CMD.HELP.test(line):
            m.result = (m.result ? m.result : "") + "\nmodule list|load|reload|unload [modulename]";
    }
    return m;
}

async function stop() {
    if (JENGINE === null) return;
    await Promise.allSettled(
        JENGINE.getModules()
        .filter(item => item)
        .map(handler => JENGINE.unload(handler))
    );
    await JENGINE.info("JSON Message Switch has been halted.");
}

function main() {
    // Read config
    const config = {...CONFIG, ...require(CONFIG_FILE)};

    // Start jms engine
    JENGINE = new JEngine({...config});
    JENGINE.setLevel(config.log_level);
    JENGINE.setTimeout(config.message_timeout);
    // Install engine handlers
    JENGINE.install("jengine.command", commandHandler);

    // Load modules
    config.modules.forEach(module => {
        JENGINE.load(PATH + "/node_modules/" + module)
        .catch(error => JENGINE.error(error));
    });

    // safe shutdown
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
}

main();