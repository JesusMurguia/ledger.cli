const { Command } = require("commander");
const program = new Command();

let transactions = [];

//SOFTWARE DESCRIPTION
program
  .name("ledger-cli")
  .description("CLI ledger to manage your finances by Jesus Murguia")
  .version("0.0.1");

//REGISTER COMMAND
program
  .command("register")
  .alias("reg")
  .description("Displays all the postings occurring in a single account.")
  .action(() => handleRegister(program.args, program.opts()));

//BALANCE COMMAND
program
  .command("balance")
  .alias("bal")
  .description("Displays the balances of every account in your journal.")
  .action(() => handleBalance(program.args, program.opts()));

//PRINT COMMAND
program
  .command("print")
  .alias("p")
  .description("Displays all the transactions in an alternative format.")
  .action(() => handlePrint(program.args, program.opts()));

//OPTIONS
program
  .option("--price-db", "The file for the prices database", "prices_db")
  .option("--file, -f <string...>", "The file for the ledger accounts", [
    "index.ledger",
  ])
  .option("--sort, -S <string>", "Sort a report");

program.parse(process.argv);

function handleRegister(accounts, options) {
  console.log(getTransactions(options.F));
}

function handleBalance(accounts, options) {
  console.log(getTransactions(options.F));
}

function handlePrint(accounts, options) {
  console.log(getTransactions(options.F));
}

//This function reads everyfile line by line, saves each transactions into an object and puts them into an array
function getTransactions(files) {
  const lineByLine = require("n-readlines");
  //loop through every file declared in the command line options
  for (let i = 0; i < files.length; i++) {
    let transaction = transactionFactory();
    const liner = new lineByLine(files[i]);

    let line;

    while ((line = liner.next())) {
      //if this line says it includes another file it will loop through that file and come back to the next line
      let currentLine = line.toString("ascii");

      if (currentLine.includes("!include"))
        getTransactions([currentLine.split(" ")[1]]);
      else {
        //trim the line to avoid empty spaces
        //this will also help identify new lines
        //to know when to end the current transaction
        currentLine = currentLine.trim();
        //if the next line is a comment ignore it
        if (currentLine[0] === ";") continue;

        //if theres an empty line we add the transaction to the list
        //and reset the transaction object
        if (currentLine.length === 0) {
          transactions.push(transaction);
          transaction = transactionFactory();
          continue;
        }

        //if the next line has a date in it
        //we save both the date and the title
        if (hasDate(currentLine)) {
          if (transaction.date) {
            transactions.push(transaction);
            transaction = transactionFactory();
          }
          const [date, title] = currentLine.split(/ (.*)/s);
          transaction.date = date;
          transaction.title = title;
        } else {
          //if it doesnt have a date, it has the account - amount pair
          //split the line by tabs and remove the empty ones
          const [account, amount] = currentLine
            .trim()
            .split("\t")
            .filter((n) => n);
          transaction.accounts.push(account);
          //if the amount is empty i gotta calculate the number myself
          transaction.amounts.push(amount ? amount : "EMPTY");
        }
      }
    }
    if (transaction.date) {
      transactions.push(transaction);
      transaction = transactionFactory();
    }
  }
  return transactions;
}

function hasDate(line) {
  const dateType = /(\d{4})([\/-])(\d{1,2})\2(\d{1,2})/;
  return dateType.test(line);
}
//return an empty transaction object
function transactionFactory() {
  let transaction = {
    date: "",
    title: "",
    accounts: [],
    amounts: [],
  };
  return transaction;
}
