<?php

declare(strict_types=1);

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Services;

class RateLimitFilter implements FilterInterface
{
    private const MAX_REQUESTS = 600;
    private const WINDOW_SECONDS = 60;

    public function before(RequestInterface $request, $arguments = null)
    {
        $cache = Services::cache();
        $ipAddress = $request->getIPAddress();
        $key = 'rate_limit_' . md5(config('Database')->default['database'] . $ipAddress);

        $current = $cache->get($key);

        if ($current === null) {
            $cache->save($key, 1, self::WINDOW_SECONDS);
            $remaining = self::MAX_REQUESTS - 1;
        } else {
            if ($current >= self::MAX_REQUESTS) {
                return Services::response()
                    ->setJSON(['error' => 'TOO_MANY_REQUESTS'])
                    ->setStatusCode(429)
                    ->setHeader('X-RateLimit-Remaining', '0')
                    ->setHeader('X-RateLimit-Reset', (string) (time() + self::WINDOW_SECONDS));
            }
            $cache->increment($key);
            $remaining = self::MAX_REQUESTS - $current - 1;
        }

        // Pass headers downstream via response somehow, but in before() we can't easily set response headers
        // We will store them in the request to be applied in after() if needed, but for simplicity
        // setting them dynamically in CI4 usually requires an after() filter.
        $request->setHeader('X-RateLimit-Remaining-Internal', (string) $remaining);
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $remaining = $request->header('X-RateLimit-Remaining-Internal');
        if ($remaining) {
            $response->setHeader('X-RateLimit-Remaining', $remaining->getValue());
        }
        $response->setHeader('X-RateLimit-Limit', (string) self::MAX_REQUESTS);
    }
}
