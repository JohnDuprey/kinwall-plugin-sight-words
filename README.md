# Sight words

A reading game for [Kinwall](https://github.com/JohnDuprey/kinwall), for ages 4 to 7. Kinwall says a word out loud and the child taps it. Ten stars move up a level, and each child's stars and level are saved.

- **Four levels** of common sight words, from "a, I, the" up to words like "again" and "thank".
- **Spoken words and praise**, slowed down for clarity, with a 🔊 button to hear the word again.
- **Kind by design:** no timers, no losing, and a missed word just gets another try.

## Install

In Kinwall, go to **Activities → Get more activities**. Sight words is listed under **Reviewed by Kinwall**.

## Develop

This plugin is built from [kinwall-plugin-hello-world](https://github.com/JohnDuprey/kinwall-plugin-hello-world); its README covers the SDK, the limits and how publishing works.

- **Preview:** `python3 -m http.server 8000`, then open http://localhost:8000/dev/.
- **Package:** `scripts/package.sh` builds `kinwall-plugin.zip`.
- **Release:** bump `version` in `kinwall-plugin.json` and publish a release tagged `v<version>`. The workflow attaches the package.

## License

MIT
