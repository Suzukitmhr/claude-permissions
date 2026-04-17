'use strict';

const SENSITIVE_FILE_RULES = [
  { label: '.env', filePattern: /\.env(?:$|\.)/, bashPattern: /(^|[\s"'`=/:\\])\.env(?:$|[\s"'`.:\\/])/ },
  { label: 'appsettings.json', filePattern: /appsettings\.json$/i, bashPattern: /appsettings\.json/i },
  { label: 'appsettings.*.json', filePattern: /appsettings\..+\.json$/i, bashPattern: /appsettings\..+\.json/i },
  { label: 'ssc-connections.json', filePattern: /ssc-connections\.json$/i, bashPattern: /ssc-connections\.json/i },
  { label: 'ssc-connections.*.json', filePattern: /ssc-connections\..+\.json$/i, bashPattern: /ssc-connections\..+\.json/i },
  { label: 'id_rsa', filePattern: /id_rsa$/i, bashPattern: /(^|[\s"'`=/:\\])id_rsa($|[\s"'`.:\\/])/i },
  { label: 'id_ed25519', filePattern: /id_ed25519$/i, bashPattern: /(^|[\s"'`=/:\\])id_ed25519($|[\s"'`.:\\/])/i },
  { label: '.aws/credentials', filePattern: /[\/\\]\.aws[\/\\]credentials$/i, bashPattern: /\.aws[\/\\]credentials/i },
  { label: '.aws/config', filePattern: /[\/\\]\.aws[\/\\]config$/i, bashPattern: /\.aws[\/\\]config/i },
  { label: '*.pem', filePattern: /\.pem$/i, bashPattern: /\.pem($|[\s"'`.:\\/])/i },
  { label: '*.key', filePattern: /\.key$/i, bashPattern: /\.key($|[\s"'`.:\\/])/i },
  { label: '*.pfx', filePattern: /\.pfx$/i, bashPattern: /\.pfx($|[\s"'`.:\\/])/i },
  { label: '*.p12', filePattern: /\.p12$/i, bashPattern: /\.p12($|[\s"'`.:\\/])/i },
  { label: 'docker-compose.yml', filePattern: /docker-compose\.yml$/i, bashPattern: /docker-compose\.yml/i },
  { label: 'docker-compose.*.yml', filePattern: /docker-compose\..+\.yml$/i, bashPattern: /docker-compose\..+\.yml/i },
  { label: 'config.xml', filePattern: /config\.xml$/i, bashPattern: /config\.xml/i },
];

const DANGEROUS_COMMAND_RULES = [
  { label: 'sudo', pattern: /(^|[;&|()\s])sudo(\s|$)/i },
  { label: 'rm -rf', pattern: /(^|[;&|()\s])rm\s+-rf(\s|$)/i },
  { label: 'git push', pattern: /(^|[;&|()\s])git\s+push(\s|$)/i },
  { label: 'git reset', pattern: /(^|[;&|()\s])git\s+reset(\s|$)/i },
  { label: 'git rebase', pattern: /(^|[;&|()\s])git\s+rebase(\s|$)/i },
  { label: 'curl', pattern: /(^|[;&|()\s])curl(\s|$)/i },
  { label: 'wget', pattern: /(^|[;&|()\s])wget(\s|$)/i },
];

module.exports = {
  SENSITIVE_FILE_RULES,
  DANGEROUS_COMMAND_RULES,
};
