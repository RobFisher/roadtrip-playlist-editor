{ pkgs, ... }:
{
  packages = [
    pkgs.nodejs_22
    pkgs.awscli2
    pkgs.nodePackages.aws-cdk
  ];
}
