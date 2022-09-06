#!/bin/bash

# This script copies this repo to another repo and optionally initializes the repo.

echo "Please specify the path to the destination repo (e.g. ../destination-repo-name):"
read destination_path
echo "Would you like to clean-out the destination repo before copying (y/n)? [N]: "
read clean_repo
if [ .$clean_repo = "." ]; then
	clean_repo="n"
fi
clean_repo=$(echo $clean_repo | tr '[:upper:]' '[:lower:]')
echo "Would you like to initialize the repo? This runs the initialize-repo.sh script (y/n)? [N]: "
read init_repo
if [ .$init_repo = "." ]; then
	init_repo="n"
fi
init_repo=$(echo $init_repo | tr '[:upper:]' '[:lower:]')

if [ $clean_repo = "y" ]; then
  echo "... Cleaning out the destination repo, please wait"
  rm -rf $destination_path/*
  echo "... Done!"
fi

cp -r * $destination_path
mkdir -p $destination_path/.github
cp -r .github/* $destination_path/.github/
cp .gitignore $destination_path
cp .viperlight* $destination_path

echo "Viperlight: enter 'y' to use the custom codescan script, codescan-prebuild-custom.sh:"
echo -e "- runs python scans where there is a requirements.txt"
echo -e "- updates environment to npm@latest (regardless of whether npm is used)"
echo -e "- runs node scans where there is a package.json"
echo -e "- runs viperlight scan from the root"
echo -e "\nInstall codescan-prebuild-custom.sh (y/n)? [Y]:"
read use_custom_script
if [ .$use_custom_script = "." ]; then
	use_custom_script="y"
fi
use_custom_script=$(echo $use_custom_script | tr '[:upper:]' '[:lower:]')

if [ $use_custom_script = "y" ]; then
	cp codescan-prebuild-custom.sh $destination_path
	chmod +x $destination_path/codescan-prebuild-custom.sh
fi

if [ $init_repo = "y" ]; then
  cd $destination_path
  chmod +x initialize-repo.sh
  ./initialize-repo.sh
fi
