{
  description = "Rob's Road-trip Playlist Editor development environment";

  inputs.nixpkgs.url = "github:cachix/devenv-nixpkgs/rolling";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSystem = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forEachSystem (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          tools = import ./devenv.nix { inherit pkgs; };
        in
        {
          default = pkgs.mkShell {
            packages = tools.packages;
          };
        }
      );
    };
}
