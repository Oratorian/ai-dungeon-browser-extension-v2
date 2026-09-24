using System.Buffers.Binary;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

// stdout is exclusively Firefox's length-prefixed native messaging protocol.
// This process serves packaged engine files, never model downloads or story text.
internal static class Program
{
    private const string ExtensionId = "dungeon-extension-v2@oratorian";
    public static async Task<int> Main(string[] args)
    {
        if (args.Length != 2 || args[1] != ExtensionId) return 1;
        using var input = Console.OpenStandardInput();
        using var output = Console.OpenStandardOutput();
        using var shutdown = new CancellationTokenSource();
        EngineServer? server = null;
        try
        {
            while (true)
            {
                var header = new byte[4];
                if (await input.ReadAsync(header.AsMemory(0, 1)) == 0) break;
                await input.ReadExactlyAsync(header.AsMemory(1));
                var size = BinaryPrimitives.ReadUInt32LittleEndian(header);
                if (size is 0 or > 65536) throw new InvalidDataException("Invalid native message size.");
                var body = new byte[(int)size];
                await input.ReadExactlyAsync(body);
                using var message = JsonDocument.Parse(body);
                var root = message.RootElement;
                if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("type", out var type)
                    || type.GetString() != "start" || !root.TryGetProperty("protocol", out var protocol)
                    || !protocol.TryGetInt32(out var version) || version != 1)
                    throw new InvalidDataException("Unsupported helper protocol. Update the extension and helper together.");
                if (server == null)
                {
                    server = new EngineServer(Path.Combine(AppContext.BaseDirectory, "web"));
                    await server.Start(shutdown.Token);
                }
                await Send(output, new { type = "ready", protocol = 1, version = "1.0.0", engineUrl = "http://localhost:4177/engine.html" });
            }
            return 0;
        }
        catch (Exception error)
        {
            var message = error is SocketException
                ? "Port 4177 is busy. Stop the old Node server or another Firefox TTS helper, then retry Initialize TTS."
                : error is FileNotFoundException or DirectoryNotFoundException
                    ? "TTS helper engine files are missing. Reinstall the helper."
                    : error.Message;
            try { await Send(output, new { type = "error", message }); } catch { }
            return 1;
        }
        finally { shutdown.Cancel(); server?.Dispose(); }
    }

    private static async Task Send(Stream output, object value)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(value);
        var length = new byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(length, (uint)bytes.Length);
        await output.WriteAsync(length);
        await output.WriteAsync(bytes);
        await output.FlushAsync();
    }
}

internal sealed class EngineServer : IDisposable
{
    private readonly TcpListener listener = new(IPAddress.Loopback, 4177);
    private readonly Dictionary<string, (byte[] Bytes, string Type)> files = new(StringComparer.Ordinal);
    private readonly SemaphoreSlim requests = new(32);
    public EngineServer(string directory)
    {
        var types = new Dictionary<string, string> { [".html"] = "text/html; charset=utf-8", [".js"] = "text/javascript",
            [".mjs"] = "text/javascript", [".css"] = "text/css", [".wasm"] = "application/wasm" };
        // Build an exact URL allowlist from the installation's static web assets.
        // HTTP requests never turn into filesystem paths.
        foreach (var path in Directory.EnumerateFiles(directory, "*", SearchOption.AllDirectories))
        {
            if (!types.TryGetValue(Path.GetExtension(path), out var type)) continue;
            var key = "/" + Path.GetRelativePath(directory, path).Replace('\\', '/');
            files.Add(key, (File.ReadAllBytes(path), type));
        }
        if (!files.ContainsKey("/engine.html")) throw new FileNotFoundException();
    }
    public async Task Start(CancellationToken token)
    {
        // A thread-count change can start a replacement while Firefox is still
        // terminating the previous native process. Allow that short handover.
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                listener.Server.ExclusiveAddressUse = true;
                listener.Start();
                break;
            }
            catch (SocketException error) when (error.SocketErrorCode == SocketError.AddressAlreadyInUse && attempt < 20)
            {
                listener.Stop();
                await Task.Delay(100, token);
            }
        }
        _ = Accept(token);
    }
    private async Task Accept(CancellationToken token)
    {
        try
        {
            while (!token.IsCancellationRequested)
            {
                var client = await listener.AcceptTcpClientAsync(token);
                if (!requests.Wait(0)) { client.Dispose(); continue; }
                _ = Serve(client, token);
            }
        }
        catch (OperationCanceledException) { }
        catch (ObjectDisposedException) { }
        catch (SocketException) when (token.IsCancellationRequested) { }
    }
    private async Task Serve(TcpClient client, CancellationToken token)
    {
        using (client)
        using (var deadline = CancellationTokenSource.CreateLinkedTokenSource(token))
        {
            deadline.CancelAfter(TimeSpan.FromSeconds(10));
            var cancel = deadline.Token;
            try
            {
                var stream = client.GetStream();
                // Cap all request headers and require their terminator. No request bodies accepted.
                var buffer = new byte[16384];
                var used = 0;
                string? headers = null;
                while (used < buffer.Length)
                {
                    var count = await stream.ReadAsync(buffer.AsMemory(used), cancel);
                    if (count == 0) return;
                    used += count;
                    var text = Encoding.ASCII.GetString(buffer, 0, used);
                    var end = text.IndexOf("\r\n\r\n", StringComparison.Ordinal);
                    if (end >= 0) { headers = text[..end]; break; }
                }
                if (headers == null) { await Reply(stream, 431, [], "text/plain", false, cancel); return; }
                var lines = headers.Split("\r\n");
                var request = lines[0].Split(' ');
                var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var line in lines.Skip(1))
                {
                    var colon = line.IndexOf(':');
                    if (colon <= 0 || !fields.TryAdd(line[..colon].Trim(), line[(colon + 1)..].Trim()))
                    { await Reply(stream, 400, [], "text/plain", false, cancel); return; }
                }
                if (request.Length != 3 || request[2] != "HTTP/1.1") { await Reply(stream, 400, [], "text/plain", false, cancel); return; }
                if (!fields.TryGetValue("Host", out var host) || host != "localhost:4177"
                    || (fields.TryGetValue("Origin", out var origin) && origin != "http://localhost:4177"))
                { await Reply(stream, 403, [], "text/plain", false, cancel); return; }
                var head = request[0] == "HEAD";
                if (!head && request[0] != "GET") { await Reply(stream, 405, [], "text/plain", false, cancel); return; }
                var url = request[1];
                if (!url.StartsWith('/') || url.Contains('%') || url.Contains('?') || !files.TryGetValue(url, out var file))
                { await Reply(stream, 404, [], "text/plain", head, cancel); return; }
                await Reply(stream, 200, file.Bytes, file.Type, head, cancel);
            }
            catch (Exception error) when (error is IOException or OperationCanceledException or SocketException) { }
            finally { requests.Release(); }
        }
    }
    private static async Task Reply(Stream stream, int status, byte[] body, string type, bool head, CancellationToken token)
    {
        var reason = status switch { 200 => "OK", 400 => "Bad Request", 403 => "Forbidden", 404 => "Not Found", 405 => "Method Not Allowed", _ => "Request Header Fields Too Large" };
        var headers = $"HTTP/1.1 {status} {reason}\r\nContent-Type: {type}\r\nContent-Length: {body.Length}\r\nConnection: close\r\n"
            + "Cross-Origin-Opener-Policy: same-origin\r\nCross-Origin-Embedder-Policy: require-corp\r\nCross-Origin-Resource-Policy: same-origin\r\n"
            + "X-Content-Type-Options: nosniff\r\nCache-Control: no-cache\r\nReferrer-Policy: no-referrer\r\n"
            + "Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'\r\n\r\n";
        await stream.WriteAsync(Encoding.ASCII.GetBytes(headers), token);
        if (!head && body.Length > 0) await stream.WriteAsync(body, token);
    }
    public void Dispose() => listener.Stop();
}
