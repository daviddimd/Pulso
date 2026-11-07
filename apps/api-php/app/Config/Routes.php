<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */

// Root health check
$routes->get('health', 'HealthController::index');

$routes->group('api', ['namespace' => 'App\Controllers'], static function ($routes) {
    // API health check
    $routes->get('health', 'HealthController::index');

    // Auth routes
    $routes->group('auth', static function ($routes) {
        $routes->get('options', 'AuthController::options');
        $routes->get('session', 'AuthController::session');
        $routes->post('login', 'AuthController::login');
        $routes->get('me', 'AuthController::me');
        $routes->post('logout', 'AuthController::logout');

        $routes->group('clave-unica', static function ($routes) {
            $routes->get('/', 'AuthController::claveUnicaRedirect');
            $routes->get('callback', 'AuthController::claveUnicaCallback');
        });
    });

    // Services routes
    $routes->group('services', static function ($routes) {
        $routes->get('/', 'ServicesController::index');
        $routes->get('mine', 'ServicesController::mine');
        $routes->post('/', 'ServicesController::create');
        $routes->get('(:segment)', 'ServicesController::show/$1');
        $routes->get('(:segment)/audit', 'ServicesController::audit/$1');
        $routes->post('(:segment)/(:segment)', 'ServicesController::command/$1/$2'); // Command pattern e.g., /services/:id/start
    });

    // Vehicles routes
    $routes->group('vehicles', static function ($routes) {
        $routes->get('/', 'VehiclesController::index');
        $routes->get('(:segment)/odometer-history', 'VehiclesController::odometerHistory/$1');
        $routes->post('/', 'VehiclesController::create');
        $routes->patch('(:segment)', 'VehiclesController::update/$1');
    });

    // Admin routes
    $routes->group('admin', static function ($routes) {
        $routes->get('drivers', 'AdminController::drivers');
        $routes->get('drivers/(:segment)', 'AdminController::driver/$1');
    });

    // Cost Centers routes
    $routes->group('cost-centers', static function ($routes) {
        $routes->get('/', 'CostCentersController::index');
        $routes->get('summary', 'CostCentersController::summary');
        $routes->get('export', 'CostCentersController::export');
        $routes->get('export-pdf', 'CostCentersController::exportPdf');
    });

    // Exports routes
    $routes->group('exports', static function ($routes) {
        $routes->get('daily', 'ExportsController::daily');
        $routes->get('daily-pdf', 'ExportsController::dailyPdf');
    });

});

$routes->get('/', 'FrontendController::index');
