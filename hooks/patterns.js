'use strict';

/**
 * 保護対象ファイルの定義（単一ソース）。
 * filePattern: ファイルパス末尾マッチ用 (block-sensitive-files.js)
 * bashPattern: Bashコマンド文字列部分マッチ用 (block-sensitive-bash.js)
 */
const SENSITIVE_FILE_RULES = [
  // 環境変数
  { label: '.env',                   filePattern: /\.env$/,                    bashPattern: /\.env(\s|$|\.)/ },
  { label: '.env.*',                 filePattern: /\.env\./,                   bashPattern: /\.env\./ },
  // アプリケーション設定
  { label: 'appsettings.json',       filePattern: /appsettings\.json$/,        bashPattern: /appsettings\.json/ },
  { label: 'appsettings.*.json',     filePattern: /appsettings\..+\.json$/,    bashPattern: /appsettings\..+\.json/ },
  { label: 'ssc-connections.json',   filePattern: /ssc-connections\.json$/,    bashPattern: /ssc-connections\.json/ },
  { label: 'ssc-connections.*.json', filePattern: /ssc-connections\..+\.json$/,bashPattern: /ssc-connections\..+\.json/ },
  // SSH鍵
  { label: 'id_rsa',                 filePattern: /id_rsa$/,                   bashPattern: /id_rsa/ },
  { label: 'id_ed25519',             filePattern: /id_ed25519$/,               bashPattern: /id_ed25519/ },
  // AWS認証情報
  { label: '.aws/credentials',       filePattern: /[\/\\]\.aws[\/\\]credentials$/, bashPattern: /\.aws[\/\\]credentials/ },
  { label: '.aws/config',            filePattern: /[\/\\]\.aws[\/\\]config$/,      bashPattern: /\.aws[\/\\]config/ },
  // 秘密鍵・証明書
  { label: '*.pem',                  filePattern: /\.pem$/,                    bashPattern: /\.pem(\s|$)/ },
  { label: '*.key',                  filePattern: /\.key$/,                    bashPattern: /\.key(\s|$)/ },
  { label: '*.pfx',                  filePattern: /\.pfx$/,                    bashPattern: /\.pfx(\s|$)/ },
  { label: '*.p12',                  filePattern: /\.p12$/,                    bashPattern: /\.p12(\s|$)/ },
  // Dockerシークレット
  { label: 'docker-compose.yml',     filePattern: /docker-compose\.yml$/,      bashPattern: /docker-compose\.yml/ },
  { label: 'docker-compose.*.yml',   filePattern: /docker-compose\..+\.yml$/,  bashPattern: /docker-compose\..+\.yml/ },
  // 設定ファイル
  { label: 'config.xml',             filePattern: /config\.xml$/,              bashPattern: /config\.xml/ },
];

const fileBlockPatterns = SENSITIVE_FILE_RULES.map(r => r.filePattern);
const bashBlockPatterns = SENSITIVE_FILE_RULES.map(r => r.bashPattern);

module.exports = { SENSITIVE_FILE_RULES, fileBlockPatterns, bashBlockPatterns };
