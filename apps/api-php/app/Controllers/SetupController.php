<?php
namespace App\Controllers;

use App\Models\SetupRepository;

final class SetupController extends BaseApiController
{
    public function status()
    {
        $this->response->setHeader('Cache-Control', 'no-store');
        return $this->attempt(fn() => $this->jsonResponse((new SetupRepository())->status()));
    }

    public function create()
    {
        return $this->attempt(function () {
            $result = (new SetupRepository())->complete(
                $this->getRequestBody(),
                $this->getClientIp(),
            );
            return $this->jsonResponse(['username' => $result['username']], 201);
        });
    }
}
