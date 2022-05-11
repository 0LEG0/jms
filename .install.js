"use strict";
/**
 * Run to copy modules config files from ./node_modules/[*]/conf/[*] to ./conf/[*]
 */
const fs = require("fs");

function copyConf(src, dst) {
    fs.readdir(src, (err, configs) => {
        if (err) return;
        configs.forEach(confile => {
            fs.access(dst + confile, (err) => {
                if (err) {
                    fs.copyFile(src + confile, dst + confile, (err) => {
                        if (err)
                            console.log("Failed copy config file", src + confile);
                        else
                            console.log("Copy config file", src + confile + " -> " + dst + confile);
                    });
                } else {
                    console.log("Keep old config file", dst + confile);
                }
            });
        });
    })
}
fs.readdir("node_modules", (err, node_modules) => {
    if (err) return;
    node_modules.forEach(module => {
        if (module.startsWith(".")) return;
        copyConf("node_modules/" + module + "/conf/", "conf/");
    })
})