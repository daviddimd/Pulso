<?php

declare(strict_types=1);

namespace App\Controllers;

use Throwable;

class HealthController extends BaseApiController
{
    public function index()
    {
        try {
            $dbOk = (new \App\Models\SystemRepository())->healthy();
        } catch (Throwable $e) {
            $dbOk = false;
        }

        $status = $dbOk ? 200 : 503;
        return $this->jsonResponse([
            'status'    => $dbOk ? 'ok' : 'degraded',
            'database'  => $dbOk ? 'connected' : 'error',
            'timestamp' => date('c'),
            'system'    => 'Pulso API (CodeIgniter 4)',
        ], $status);
    }
}
