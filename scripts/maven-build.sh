#!/bin/sh
set -eu
# Build secrets are optional on normal networks. Never disable TLS verification.
if [ -f /run/secrets/proxy_ca ]; then
  cp "$JAVA_HOME/lib/security/cacerts" /tmp/transit-cacerts
  keytool -importcert -noprompt -alias session-proxy -file /run/secrets/proxy_ca -keystore /tmp/transit-cacerts -storepass changeit >/dev/null 2>&1
  export MAVEN_OPTS="${MAVEN_OPTS:-} -Djavax.net.ssl.trustStore=/tmp/transit-cacerts -Djavax.net.ssl.trustStorePassword=changeit"
fi
if [ -f /run/secrets/maven_settings ]; then
  mvn -B -s /run/secrets/maven_settings "$@"
elif [ -n "${HTTPS_PROXY:-}" ]; then
  proxy_endpoint=${HTTPS_PROXY#*://}
  proxy_host=${proxy_endpoint%:*}
  proxy_port=${proxy_endpoint##*:}
  printf '<settings><proxies><proxy><id>cloud</id><active>true</active><protocol>http</protocol><host>%s</host><port>%s</port></proxy></proxies></settings>' "$proxy_host" "$proxy_port" > /tmp/transit-maven-settings.xml
  mvn -B -s /tmp/transit-maven-settings.xml "$@"
  rm -f /tmp/transit-maven-settings.xml
else
  mvn -B "$@"
fi
rm -f /tmp/transit-cacerts
