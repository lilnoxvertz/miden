## Requirements

1. Node.js
2. Rust
3. Visual code with Desktop c++ development kit

after that, install all of the modules

```bash
    npm install
```

and make sure that miden client is installed. if you haven't installed miden client, just type
```bash
    cargo install miden-cli
```

## Notes

This script will run forever till you stop it by yourself. if any of your address/account failed consuming notes, it's fine.

## Warning

IF BY ANY CHANCE THAT YOU REMOVE ANY CLIENT AT THE CLIENTS FOLDER, MAKE SURE TO DELETE THE ADDRESS ON ONE OF THIS FILE, BASED FROM WHICH FOLDER DID YOU DELETED IT (PUBLIC / PRIVATE).

```bash
    privateAccountId.txt
```

or

```bash
    publicAccountId.txt
```

## Commands

1. Creating private and public account

```bash
    npm run create
```

2. Sending token, Claiming faucet, Consuming notes

```bash
    npm start
```
