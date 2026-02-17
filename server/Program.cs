var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

// Serve static files from wwwroot (the Angular build output)
app.UseStaticFiles();

// For any request that doesn't match a static file, serve index.html
// so Angular's client-side router can handle routes like /:year/:month
app.MapFallbackToFile("index.html");

app.Run();
