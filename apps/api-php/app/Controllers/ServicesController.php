<?php
namespace App\Controllers;
use App\Libraries\ServiceEngine;
use App\Models\ServiceRepository;

class ServicesController extends BaseApiController
{
    public function index() {
        if ($this->getAuthUser()['role'] !== 'ADMIN') return $this->errorResponse('FORBIDDEN',403);
        return $this->mine();
    }
    public function mine() { return $this->attempt(fn()=> $this->jsonResponse((new ServiceRepository($this->getAuthUser()))->listing($this->request->getGet()))); }
    public function create() {
        return $this->attempt(function () {
            $user = $this->getAuthUser();
            $id = (new ServiceEngine())->create($this->getRequestBody(),$user);
            return $this->jsonResponse(['entry'=>(new ServiceRepository($user))->find($id)],201);
        });
    }
    public function show(string $id) {
        $entry = (new ServiceRepository($this->getAuthUser()))->find($id);
        return $entry ? $this->jsonResponse(['entry'=>$entry]) : $this->errorResponse('NOT_FOUND',404);
    }
    public function command(string $id,string $cmd) {
        return $this->attempt(function () use ($id,$cmd) {
            $user=$this->getAuthUser();
            $nextId = (new ServiceEngine())->executeCommand($cmd,$id,$this->getRequestBody(),$user);
            $repo = new ServiceRepository($user);
            $result = ['entry'=>$repo->find($id)];
            if ($nextId !== null) $result['nextEntry'] = $repo->find($nextId);
            return $this->jsonResponse($result);
        });
    }
    public function audit(string $id) {
        $user=$this->getAuthUser();
        if ($user['role'] !== 'ADMIN') return $this->errorResponse('FORBIDDEN',403);
        if (!(new ServiceRepository($user))->find($id)) return $this->errorResponse('NOT_FOUND',404);
        return $this->jsonResponse(['logs'=>(new ServiceRepository($user))->audit($id)]);
    }
}
