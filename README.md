
## Simple implementation of ledger-cli

## Getting Started

### Prerequisites

* npm
  ```sh
  npm install npm@latest -g
  ```

### Installation


1. Clone the repo
   ```sh
   git clone https://github.com/JesusMurguia/ledger.cli.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```


<!-- USAGE EXAMPLES -->
## Usage

The commands available are

 - register ( reg ): show all transactions and a running total.
   ```sh
   ./my-ledger.sh register
   ```
   ![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059348715288145930/image.png)
   
   You can filter by account and by sort by date with --sort (-S):
      ```sh
   ./my-ledger.sh --sort d register Bank: Asset: --sort d
   ```
   ![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059349294945144852/image.png)

   You can limit the dates with --begin (-b) and --end (-e) 
      ```sh
   ./my-ledger.sh register Bank: Asset: --sort d --begin 2012/01/10 --end 2012/12/29
   ```
	![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059352324969091142/image.png)

	  You can get the market value specified in the prices_db file with --market (-V) :
	```
	./my-ledger.sh register Bank: Asset: --sort d --begin 2012/01/10 --end 2012/12/29 --market
	```
	![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059352658122657892/image.png)

	  You can skip the transactions and get only the subtotal with --subtotal:
	```
	./my-ledger.sh register Bank: Asset: --sort d --begin 2012/01/10 --end 2012/12/29 --market --subtotal
	```
	![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059354143162122250/image.png)

 - balance( bal ): find the balances of all of your accounts.
   ```sh
   ./my-ledger.sh balance
   ```
   ![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059354742167449681/image.png)

	You can filter and sort by amount 
	`./my-ledger.sh balance Bank: Asset: --S amount`
	
	![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059355129259773973/image.png)

	As well as get the market value
	`./my-ledger.sh balance Bank: Asset: --S amount -V`
	
	![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059355537210359898/image.png)

- print( p ): print out transactions in a textual format.
   ```sh
   ./my-ledger.sh print
   ```
   ![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059355829310062602/image.png)
   
	You can apply the same date filters as register
	`./my-ledger.sh print  Bank: Asset: --sort d --begin 2012/01/10 --end 2012/12/29 --market`
	
	![enter image description here](https://media.discordapp.net/attachments/1004760480079958086/1059356494853853214/image.png)
