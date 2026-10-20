<?php

namespace App\Modules\Media\Actions;

final class ScanProof
{
    public function execute(string $bytes): bool
    {
        return $this->status($bytes) === 'clean';
    }

    public function status(string $bytes): string
    {
        if (config('auraflare.proof_scanner') !== 'clamav') {
            return 'pending';
        }
        $socket = @stream_socket_client('tcp://'.config('auraflare.clamav_host').':'.config('auraflare.clamav_port'), $errno, $error, 5);
        if (! $socket) {
            return 'pending';
        }
        stream_set_timeout($socket, 15);
        try {
            $this->write($socket, "zINSTREAM\0");
            foreach (str_split($bytes, 65536) as $chunk) {
                $this->write($socket, pack('N', strlen($chunk)).$chunk);
            }
            $this->write($socket, pack('N', 0));

            return self::parseReply((string) stream_get_contents($socket));
        } catch (\Throwable) {
            return 'pending';
        } finally {
            fclose($socket);
        }
    }

    public static function parseReply(string $reply): string
    {
        $reply = trim($reply, "\0\r\n ");
        if ($reply === 'stream: OK') {
            return 'clean';
        }

        return str_starts_with($reply, 'stream: ') && str_ends_with($reply, ' FOUND') ? 'infected' : 'pending';
    }

    private function write($socket, string $bytes): void
    {
        while ($bytes !== '') {
            $written = fwrite($socket, $bytes);
            if (! $written) {
                throw new \RuntimeException('Scanner unavailable.');
            } $bytes = substr($bytes, $written);
        }
    }
}
