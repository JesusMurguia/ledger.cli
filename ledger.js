// Importing the Required Modules
const fs = require("fs");
const readline = require("readline");

//arguments
const args = process.argv.slice(2);

formatFile("Income.ledger");

function formatFile(fileName) {
  const transactions = [];

  // Creating a readable stream from file
  // readline module reads line by line
  // but from a readable stream only.
  const file = readline.createInterface({
    input: fs.createReadStream(fileName),
    output: process.stdout,
    terminal: false,
  });

  let transaction = {};
  // Check each line to gather every bit of information
  // whenever a new line is read from the stream
  file.on("line", (line) => {
    //trim the line to avoid empty spaces
    //this will also help identify new lines
    //to know when to end the current transaction
    line = line.trim();

    //if the next line is a comment ignore it
    if (line[0] === ";") return;

    //if theres an empty line we add the transaction to the list
    //and reset the transaction object
    if (line.length === 0) {
      transactions.push(transaction);
      transaction = {};
      return;
    }

    //if the next line has a date in it
    //we save both the date and the title
    if (hasDate(line)) {
      const [date, title] = line.split(/ (.*)/s);
      transaction.date = date;
      transaction.title = title;
    } else {
      //if it doesnt have a date, it has the account - amount pair
      //split the line by tabs and remove the empty ones
      const [account, amount] = line
        .trim()
        .split("\t")
        .filter((n) => n);
      // transaction.accounts.push(account);
      //if the amount is empty i gotta calculate the number myself
      // transaction.amounts.push(amount ? amount : "EMPTY");
      return;
    }
  });
}

function hasDate(line) {
  const dateType = /(\d{4})([\/-])(\d{1,2})\2(\d{1,2})/;
  return dateType.test(line);
}

function transactionFactory() {
  let transaction = {
    date: "",
    title: "",
    accounts: [],
    amounts: [],
    toString: "",
  };
  return transaction;
}
