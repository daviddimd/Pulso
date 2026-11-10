<?php

namespace App\Database\Migrations;

use App\Libraries\LegacyTripImport;
use CodeIgniter\Database\Migration;

final class ConsolidateTrips extends Migration
{
    public function up()
    {
        $schema = file_get_contents(APPPATH . 'Database/schema-viajes.sql');
        preg_match_all('/CREATE TABLE (\w+)/', $schema, $matches);
        $tables = $matches[1];
        $legacy = LegacyTripImport::TABLES;

        if ($this->db->tableExists('viajes') && !$this->db->tableExists('bitacora_entries')) {
            $this->removeOldTables($legacy);
            return;
        }

        // A failed copy never replaces the old schema. Delete only staging tables on retry.
        foreach (array_reverse($tables) as $table) $this->db->query("DROP TABLE IF EXISTS nuevo_$table");
        $staging = preg_replace_callback('/(CREATE TABLE |REFERENCES )(\w+)/', fn($m) => $m[1] . 'nuevo_' . $m[2], $schema);
        foreach (explode(';', $staging) as $statement) {
            if (trim($statement) !== '') $this->db->query($statement);
        }

        // The importer targets the staging schema using the nuevo_ prefix.
        $source = fn(string $table) => $this->db->table($table)->orderBy('id')->get()->getResultArray();
        (new LegacyTripImport($this->db, 'nuevo_'))->copy($source);

        // The cutover is one atomic DDL operation. Run with the application offline.
        $renames = array_map(fn($t) => "$t TO anterior_$t", $legacy);
        foreach ($tables as $table) $renames[] = "nuevo_$table TO $table";
        $this->db->query('RENAME TABLE ' . implode(', ', $renames));

        $this->removeOldTables($legacy);
    }

    private function removeOldTables(array $legacy): void
    {
        foreach (array_reverse($legacy) as $table) $this->db->query("DROP TABLE IF EXISTS anterior_$table");
    }

    public function down()
    {
        throw new \RuntimeException('La consolidación es irreversible. Restaure el respaldo previo en una base separada.');
    }
}
