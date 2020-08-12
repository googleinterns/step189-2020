#!/bin/sh

if [ "${NODE_ENV}" != 'production' ]
then
    # We pin the ChromeDriver version to the version we currently have on our
    # remote enviroment because letting the `ng e2e` update the driver
    # automatically can cause problems (see #10 for more details).
    node_modules/.bin/webdriver-manager update \
        --gecko false \
        --standalone false \
        --versions.chrome=84.0.4147.89
fi
