#!/bin/bash
# Build and deploy script for Moon Sighting Maps
# This script builds the Angular app and the .NET server,
# then copies the Angular output into the server's wwwroot folder.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Building Angular app ==="
cd "$ROOT_DIR"
npx ng build --configuration production

echo "=== Copying Angular output to server/wwwroot ==="
rm -rf "$ROOT_DIR/server/wwwroot"
cp -r "$ROOT_DIR/dist/islamic-month/browser" "$ROOT_DIR/server/wwwroot"

echo "=== Building .NET server ==="
cd "$ROOT_DIR/server"
dotnet publish -c Release -o "$ROOT_DIR/server/publish"

echo ""
echo "=== Done ==="
echo "Publish output is in: server/publish/"
echo "Deploy the contents of server/publish/ to your IIS site."
echo ""
echo "IIS Setup:"
echo "  1. Install the .NET 9 Hosting Bundle on the server"
echo "  2. Create a new IIS site pointing to the publish folder"
echo "  3. Set the Application Pool to 'No Managed Code'"
echo "  4. Ensure the IIS_IUSRS group has read access to the folder"
