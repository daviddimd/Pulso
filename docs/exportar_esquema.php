<?php
/**
 * Exporta solo metadatos del esquema (INFORMATION_SCHEMA y SHOW CREATE TABLE) a
 * .runtime/schema-ti-domain.json, que consume generar_entregables.py. No lee registros.
 *
 * Uso, desde la raíz del repositorio:
 *   .runtime/php/php.exe docs/exportar_esquema.php [base]
 * La base por omisión es pulso_test, instalada desde cero por las migraciones en npm test.
 */
$root = dirname(__DIR__);
$env = [];
foreach (file($root . '/apps/api-php/.env') as $line) {
    if (preg_match("/^\s*(database\.default\.\w+)\s*=\s*'?([^'\r\n]*)'?/", $line, $m)) $env[$m[1]] = $m[2];
}
$database = $argv[1] ?? 'pulso_test';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$db = new mysqli($env['database.default.hostname'], $env['database.default.username'],
    $env['database.default.password'] ?? '', $database, (int)$env['database.default.port']);

$rows = function (string $sql, array $params = []) use ($db): array {
    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param(str_repeat('s', count($params)), ...$params);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
};

$schema = ['databaseVersion' => $db->query('SELECT VERSION() AS v')->fetch_assoc()['v'], 'tables' => []];
$tables = $rows("SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME<>'migrations' ORDER BY TABLE_NAME", [$database]);
foreach (array_column($tables, 'TABLE_NAME') as $table) {
    $schema['tables'][$table] = [
        'columns' => $rows("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, GENERATION_EXPRESSION
            FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", [$database, $table]),
        'foreignKeys' => $rows("SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL
            ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION", [$database, $table]),
        'ddl' => $db->query('SHOW CREATE TABLE `' . str_replace('`', '', $table) . '`')->fetch_row()[1],
    ];
}
file_put_contents($root . '/.runtime/schema-ti-domain.json', json_encode($schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
echo 'Esquema exportado desde ', $database, ': ', count($schema['tables']), " tablas.\n";
