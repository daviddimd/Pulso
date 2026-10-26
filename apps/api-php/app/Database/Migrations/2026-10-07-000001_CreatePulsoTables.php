<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePulsoTables extends Migration
{
    public function up()
    {
        // 1. establishments
        $this->forge->addField([
            'id'         => ['type' => 'CHAR', 'constraint' => 36],
            'code'       => ['type' => 'VARCHAR', 'constraint' => 30, 'unique' => true],
            'name'       => ['type' => 'VARCHAR', 'constraint' => 200],
            'timezone'   => ['type' => 'VARCHAR', 'constraint' => 60, 'default' => 'America/Santiago'],
            'active'     => ['type' => 'BOOLEAN', 'default' => true],
            'created_at' => ['type' => 'DATETIME(3)', 'null' => true],
            'updated_at' => ['type' => 'DATETIME(3)', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->createTable('establishments', true, ['ENGINE' => 'InnoDB', 'CHARSET' => 'utf8mb4']);

        // 2. users
        $this->forge->addField([
            'id'                    => ['type' => 'CHAR', 'constraint' => 36],
            'establishment_id'      => ['type' => 'CHAR', 'constraint' => 36],
            'username'              => ['type' => 'VARCHAR', 'constraint' => 50, 'unique' => true],
            'roster_code'           => ['type' => 'VARCHAR', 'constraint' => 30, 'null' => true],
            'full_name'             => ['type' => 'VARCHAR', 'constraint' => 120],
            'password_hash'         => ['type' => 'VARCHAR', 'constraint' => 255],
            'role'                  => ['type' => 'ENUM', 'constraint' => ['DRIVER', 'ADMIN']],
            'active'                => ['type' => 'BOOLEAN', 'default' => true],
            'failed_login_attempts' => ['type' => 'INT', 'default' => 0],
            'locked_until'          => ['type' => 'DATETIME(3)', 'null' => true],
            'rut'                   => ['type' => 'VARCHAR', 'constraint' => 12, 'unique' => true, 'null' => true],
            'clave_unica_sub'       => ['type' => 'VARCHAR', 'constraint' => 100, 'unique' => true, 'null' => true],
            'auth_provider'         => ['type' => 'ENUM', 'constraint' => ['local', 'clave_unica'], 'default' => 'local'],
            'created_at'            => ['type' => 'DATETIME(3)', 'null' => true],
            'updated_at'            => ['type' => 'DATETIME(3)', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('establishment_id');
        $this->forge->addUniqueKey(['establishment_id', 'roster_code']);
        $this->forge->addForeignKey('establishment_id', 'establishments', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('users', true, ['ENGINE' => 'InnoDB', 'CHARSET' => 'utf8mb4']);

        // 3. vehicles
        $this->forge->addField([
            'id'                  => ['type' => 'CHAR', 'constraint' => 36],
            'establishment_id'    => ['type' => 'CHAR', 'constraint' => 36],
            'role_code'           => ['type' => 'VARCHAR', 'constraint' => 30],
            'license_plate'       => ['type' => 'VARCHAR', 'constraint' => 20, 'unique' => true],
            'current_odometer_km' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'vehicle_type'        => ['type' => 'VARCHAR', 'constraint' => 60, 'null' => true],
            'year'                => ['type' => 'SMALLINT', 'unsigned' => true, 'null' => true],
            'model'               => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true],
            'active'              => ['type' => 'BOOLEAN', 'default' => true],
            'created_at'          => ['type' => 'DATETIME(3)', 'null' => true],
            'updated_at'          => ['type' => 'DATETIME(3)', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('establishment_id');
        $this->forge->addForeignKey('establishment_id', 'establishments', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('vehicles', true, ['ENGINE' => 'InnoDB', 'CHARSET' => 'utf8mb4']);

        // Check constraint for vehicles
        $this->db->query('CREATE UNIQUE INDEX vehicle_tenant_role ON vehicles (establishment_id, role_code)');
        $this->db->query("ALTER TABLE vehicles ADD CONSTRAINT vehicle_odometer_nonnegative CHECK (current_odometer_km >= 0 OR current_odometer_km IS NULL)");

        // 4. cost_centers
        $this->forge->addField([
            'id'               => ['type' => 'CHAR', 'constraint' => 36],
            'establishment_id' => ['type' => 'CHAR', 'constraint' => 36],
            'code'             => ['type' => 'VARCHAR', 'constraint' => 30],
            'name'             => ['type' => 'VARCHAR', 'constraint' => 200],
            'active'           => ['type' => 'BOOLEAN', 'default' => true],
            'created_at'       => ['type' => 'DATETIME(3)', 'null' => true],
            'updated_at'       => ['type' => 'DATETIME(3)', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['establishment_id', 'code']);
        $this->forge->addKey('establishment_id');
        $this->forge->addForeignKey('establishment_id', 'establishments', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->createTable('cost_centers', true, ['ENGINE' => 'InnoDB', 'CHARSET' => 'utf8mb4']);

        // 5. bitacora_entries
        $this->forge->addField([
            'id'                 => ['type' => 'CHAR', 'constraint' => 36],
            'establishment_id'   => ['type' => 'CHAR', 'constraint' => 36],
            'cost_center_id'     => ['type' => 'CHAR', 'constraint' => 36, 'null' => true],
            'driver_id'          => ['type' => 'CHAR', 'constraint' => 36, 'null' => true],
            'vehicle_id'         => ['type' => 'CHAR', 'constraint' => 36, 'null' => true],
            'created_by_user_id' => ['type' => 'CHAR', 'constraint' => 36, 'null' => true],
            'origin'             => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'USER'],
            'version'            => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
            'cancelled_at'       => ['type' => 'DATETIME(3)', 'null' => true],
            'status'             => ['type' => 'ENUM', 'constraint' => ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], 'default' => 'PENDING'],
            'started_at'         => ['type' => 'DATETIME(3)', 'null' => true],
            'ended_at'           => ['type' => 'DATETIME(3)', 'null' => true],
            'service_address'    => ['type' => 'VARCHAR', 'constraint' => 350],
            'action_performed'   => ['type' => 'VARCHAR', 'constraint' => 250],
            'odometer_km'        => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'void_reason'        => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
            'created_at'         => ['type' => 'DATETIME(3)', 'null' => true],
            'updated_at'         => ['type' => 'DATETIME(3)', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('establishment_id');
        $this->forge->addKey('cost_center_id');
        $this->forge->addKey('driver_id');
        $this->forge->addKey('vehicle_id');
        $this->forge->addKey('created_by_user_id');

        $this->forge->addForeignKey('establishment_id', 'establishments', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('cost_center_id', 'cost_centers', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('driver_id', 'users', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('vehicle_id', 'vehicles', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('created_by_user_id', 'users', 'id', 'RESTRICT', 'RESTRICT');

        // Indexes for bitacora_entries
        $this->forge->addKey(['driver_id', 'started_at']);
        $this->forge->addKey(['cost_center_id', 'status', 'ended_at']);
        $this->forge->addKey(['vehicle_id', 'started_at']);
        $this->forge->addKey(['status', 'started_at']);
        $this->forge->addKey(['status', 'ended_at']);
        $this->forge->addKey(['establishment_id', 'status']);
        $this->forge->createTable('bitacora_entries', true, ['ENGINE' => 'InnoDB', 'CHARSET' => 'utf8mb4']);

        $this->db->query("ALTER TABLE bitacora_entries ADD CONSTRAINT bitacora_odometer_nonnegative CHECK (odometer_km >= 0 OR odometer_km IS NULL)");
        $this->db->query("
            ALTER TABLE bitacora_entries ADD CONSTRAINT service_operational_state CHECK (
                origin = 'LEGACY' OR (
                    (status = 'PENDING' AND driver_id IS NULL AND started_at IS NULL) OR
                    (status = 'ASSIGNED' AND driver_id IS NOT NULL AND started_at IS NULL) OR
                    (status = 'IN_PROGRESS' AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND started_at IS NOT NULL AND ended_at IS NULL) OR
                    (status = 'COMPLETED' AND driver_id IS NOT NULL AND vehicle_id IS NOT NULL AND started_at IS NOT NULL AND ended_at IS NOT NULL) OR
                    (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND started_at IS NULL AND odometer_km IS NULL)
                )
            )
        ");

        // 6. service_legs
        $this->forge->addField([
            'id'                    => ['type' => 'CHAR', 'constraint' => 36],
            'service_id'            => ['type' => 'CHAR', 'constraint' => 36],
            'driver_id'             => ['type' => 'CHAR', 'constraint' => 36],
            'vehicle_id'            => ['type' => 'CHAR', 'constraint' => 36],
            'started_at'            => ['type' => 'DATETIME(3)'],
            'ended_at'              => ['type' => 'DATETIME(3)', 'null' => true],
            'departure_odometer_km' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'arrival_odometer_km'   => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'created_at'            => ['type' => 'DATETIME(3)', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('service_id');
        $this->forge->addKey('driver_id');
        $this->forge->addKey('vehicle_id');
        $this->forge->addKey(['service_id', 'started_at']);

        $this->forge->addForeignKey('service_id', 'bitacora_entries', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('driver_id', 'users', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('vehicle_id', 'vehicles', 'id', 'RESTRICT', 'RESTRICT');

        $this->forge->createTable('service_legs', true, ['ENGINE' => 'InnoDB', 'CHARSET' => 'utf8mb4']);

        $this->db->query("ALTER TABLE service_legs ADD COLUMN active_driver_id CHAR(36) GENERATED ALWAYS AS (IF(ended_at IS NULL, driver_id, NULL)) STORED");
        $this->db->query("ALTER TABLE service_legs ADD COLUMN active_vehicle_id CHAR(36) GENERATED ALWAYS AS (IF(ended_at IS NULL, vehicle_id, NULL)) STORED");
        $this->db->query("ALTER TABLE service_legs ADD COLUMN active_service_id CHAR(36) GENERATED ALWAYS AS (IF(ended_at IS NULL, service_id, NULL)) STORED");

        $this->db->query("CREATE UNIQUE INDEX idx_active_driver ON service_legs (active_driver_id)");
        $this->db->query("CREATE UNIQUE INDEX idx_active_vehicle ON service_legs (active_vehicle_id)");
        $this->db->query("CREATE UNIQUE INDEX idx_active_service ON service_legs (active_service_id)");

        $this->db->query("ALTER TABLE service_legs ADD CONSTRAINT service_leg_km CHECK (departure_odometer_km IS NULL OR arrival_odometer_km IS NULL OR (departure_odometer_km >= 0 AND arrival_odometer_km >= 0 AND arrival_odometer_km >= departure_odometer_km))");
        $this->db->query("ALTER TABLE service_legs ADD CONSTRAINT service_leg_dates CHECK (ended_at IS NULL OR ended_at >= started_at)");

        // 7. service_address_revisions
        $this->forge->addField([
            'id'            => ['type' => 'CHAR', 'constraint' => 36],
            'service_id'    => ['type' => 'CHAR', 'constraint' => 36],
            'revision'      => ['type' => 'INT'],
            'address'       => ['type' => 'VARCHAR', 'constraint' => 350],
            'actor_user_id' => ['type' => 'CHAR', 'constraint' => 36, 'null' => true],
            'source'        => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'USER'],
            'created_at'    => ['type' => 'DATETIME(3)', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['service_id', 'revision']);
        $this->forge->addKey('service_id');
        $this->forge->addKey('actor_user_id');

        $this->forge->addForeignKey('service_id', 'bitacora_entries', 'id', 'RESTRICT', 'RESTRICT');
        $this->forge->addForeignKey('actor_user_id', 'users', 'id', 'RESTRICT', 'RESTRICT');

        $this->forge->createTable('service_address_revisions', true, ['ENGINE' => 'InnoDB', 'CHARSET' => 'utf8mb4']);

        // 8. sessions
        $this->forge->addField([
            'id'           => ['type' => 'CHAR', 'constraint' => 36],
            'user_id'      => ['type' => 'CHAR', 'constraint' => 36],
            'token_hash'   => ['type' => 'CHAR', 'constraint' => 64, 'unique' => true],
            'expires_at'   => ['type' => 'DATETIME(3)'],
            'revoked_at'   => ['type' => 'DATETIME(3)', 'null' => true],
            'created_at'   => ['type' => 'DATETIME(3)', 'null' => true],
            'last_seen_at' => ['type' => 'DATETIME(3)', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['user_id', 'expires_at']);

        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');

        $this->forge->createTable('sessions', true, ['ENGINE' => 'InnoDB', 'CHARSET' => 'utf8mb4']);

        // 9. audit_logs
        $this->forge->addField([
            'id'            => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'actor_user_id' => ['type' => 'CHAR', 'constraint' => 36, 'null' => true],
            'entity_type'   => ['type' => 'VARCHAR', 'constraint' => 60],
            'entity_id'     => ['type' => 'VARCHAR', 'constraint' => 80],
            'action'        => ['type' => 'VARCHAR', 'constraint' => 80],
            'before_data'   => ['type' => 'JSON', 'null' => true],
            'after_data'    => ['type' => 'JSON', 'null' => true],
            'ip_address'    => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true],
            'created_at'    => ['type' => 'DATETIME(3)', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['entity_type', 'entity_id', 'created_at']);
        $this->forge->addKey(['actor_user_id', 'created_at']);

        $this->forge->addForeignKey('actor_user_id', 'users', 'id', 'SET NULL', 'SET NULL');

        $this->forge->createTable('audit_logs', true, ['ENGINE' => 'InnoDB', 'CHARSET' => 'utf8mb4']);
    }

    public function down()
    {
        $this->forge->dropTable('audit_logs', true);
        $this->forge->dropTable('sessions', true);
        $this->forge->dropTable('service_address_revisions', true);
        $this->forge->dropTable('service_legs', true);
        $this->forge->dropTable('bitacora_entries', true);
        $this->forge->dropTable('cost_centers', true);
        $this->forge->dropTable('vehicles', true);
        $this->forge->dropTable('users', true);
        $this->forge->dropTable('establishments', true);
    }
}
