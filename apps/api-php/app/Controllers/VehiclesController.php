<?php
namespace App\Controllers;
use App\Models\VehicleRepository;
class VehiclesController extends BaseApiController {
    public function index() { return $this->jsonResponse(['vehicles'=>(new VehicleRepository())->listing($this->getAuthUser())]); }
    public function create() {
        if ($this->getAuthUser()['role']!=='ADMIN') return $this->errorResponse('FORBIDDEN',403);
        return $this->attempt(fn()=> $this->jsonResponse(['vehicle'=>(new VehicleRepository())->create($this->getRequestBody(),$this->getAuthUser())],201));
    }
    public function update(string $id) {
        if ($this->getAuthUser()['role']!=='ADMIN') return $this->errorResponse('FORBIDDEN',403);
        return $this->attempt(fn()=> $this->jsonResponse(['vehicle'=>(new VehicleRepository())->update($id,$this->getRequestBody(),$this->getAuthUser())]));
    }
}
