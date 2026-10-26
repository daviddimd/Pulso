<?php
namespace Config;
use CodeIgniter\Config\Filters as BaseFilters;
class Filters extends BaseFilters {
    public array $aliases = ['auth'=>\App\Filters\AuthFilter::class,'admin'=>\App\Filters\AdminFilter::class,'cors'=>\App\Filters\CorsFilter::class,'ratelimit'=>\App\Filters\RateLimitFilter::class];
    public array $required = ['before'=>[], 'after'=>[]];
    public array $globals = ['before'=>['cors','ratelimit'],'after'=>['cors']];
    public array $methods = [];
    public array $filters = ['auth'=>['before'=>['api/auth/me','api/auth/logout','api/services*','api/vehicles*','api/admin*','api/cost-centers*','api/exports*']], 'admin'=>['before'=>['api/admin*','api/exports*','api/cost-centers/summary','api/cost-centers/export*']]];
}
