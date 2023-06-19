pragma solidity >=0.4.21 <0.6.0;

import 'openzeppelin-solidity/contracts/token/ERC721/ERC721Full.sol';
import "openzeppelin-solidity/contracts/token/ERC721/IERC721Receiver.sol";

contract TulipToken is ERC721Full {
      // How do we guarantee that this contract is only created once?

    address public owner;  // The tulip grower 
    uint256 public maxTulips;  // The total number of tulips that can be minted
    uint256 public tulipCount;  // The number of tulips that have been minted

    mapping (uint256 => uint256) public tokenCreationTime;
    mapping (uint256 => uint256) public tokenLifeSpan;

    event TulipBorn(uint256 tokenId);
    event TulipBlighted(uint256 tokenId);
    event TulipExists(uint256 tokenId);

    constructor() ERC721Full("Tulip", "TLP") public {
        owner = msg.sender;
        maxTulips = 100;
        tulipCount = 0;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    function mint(uint256 lifeSpan) public onlyOwner() {
        // How do we restrict who can mint a token?
        require(tulipCount < maxTulips, "No more tulip bulbs");
        _mint(owner, tulipCount);
        tokenCreationTime[tulipCount] = now;
        tokenLifeSpan[tulipCount] = lifeSpan;
        emit TulipBorn(tulipCount);
        tulipCount ++;
    }

    function viewTulip(uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId));

        if (now - tokenCreationTime[tokenId] > tokenLifeSpan[tokenId]) {
            _burn(tokenId);
            emit TulipBlighted(tokenId);
        }
        else {
            emit TulipExists(tokenId);
        }
    }
}

contract Bloemenveiling {
    address payable public owner;
    TulipToken public tulips; // points to the ERC721 contract

    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }

    // Could put this into Auction struct, but messy if it contains a mapping
    mapping(uint256 => mapping(uint256 => Bid)) public bids;
    mapping(uint256 => uint256) public bidCounts;
    mapping(uint256 => uint256) public auctionEnds;
    mapping(uint256 => bool) public ended;

    uint256 public auctionCount;
    uint256 public maxTulips;

    // Allowed withdrawals of previous bids
    mapping(address => uint256) public pendingReturns;

    event AuctionStarted(uint256 auctionId);
    event HighestBidIncreased(uint256 auctionId, address bidder, uint256 amount, uint256 timestamp);
    event BidWithdrawn(address bidder);
    event AuctionEnded(uint256 auctionId, address winner, uint256 amount);

    constructor() public {
        owner = msg.sender;
        auctionCount = 0;
        maxTulips = 100;  // number of tulips in this series
        tulips = new TulipToken();
        startAuction(100 finney, 2 minutes, 10 days);
        startAuction(100 finney, 3 minutes, 10 days);
        startAuction(100 finney, 4 minutes, 10 days);
        startAuction(100 finney, 5 minutes, 10 days);
        startAuction(100 finney, 6 minutes, 10 days);
        startAuction(100 finney, 7 minutes, 10 days);
        startAuction(100 finney, 8 minutes, 10 days);
    }

    function startAuction(uint256 minBid, uint256 auctionSpan, uint256 lifeSpan) public {
        require(msg.sender == owner, "Only guild members can auction tulips.");
        // This will revert if all the tokens have been created already
        // If not, creates a new token owned by this contract
        tulips.mint(lifeSpan);

        // Set up the auction fields and enter starting bid
        bids[auctionCount][0] = Bid(address(this), minBid, now);
        bidCounts[auctionCount] = 1;
        auctionEnds[auctionCount] = now + auctionSpan;
        ended[auctionCount] = false;
        emit AuctionStarted(auctionCount);
        auctionCount ++;
    }

    function startOpeningNightAuction() public {
        startAuction(100 finney, 1 hours, 1 weeks);
    }

    function startNormalAuction() public {
        startAuction(100 finney, 1 weeks, 2 weeks);
    }

    /// Bid on the auction with the value sent
    /// together with this transaction.
    /// The value will only be refunded if the
    /// auction is not won.
    function bid(uint256 id) public payable {
        // Revert the call if the bidding period is over.
        require(now <= auctionEnds[id], "Auction already ended.");

        // If the bid is not higher, send the money back.
        Bid memory highestBid = bids[id][bidCounts[id] - 1];
        require(msg.value > highestBid.amount, "There already is a higher bid.");

        if (highestBid.amount != 0) {
            // Let the recipients withdraw their money themselves.
            pendingReturns[highestBid.bidder] += highestBid.amount;
        }
        bids[id][bidCounts[id]] = Bid(msg.sender, msg.value, now);
        emit HighestBidIncreased(id, msg.sender, msg.value, now);
        bidCounts[id] ++;
    }

    /// Withdraw a bid that was overbid.
    function withdraw() public returns (bool) {
        uint amount = pendingReturns[msg.sender];
        if (amount > 0) {
            pendingReturns[msg.sender] = 0;

            if (!msg.sender.send(amount)) {
                // No need to call throw here, just reset the amount owing
                pendingReturns[msg.sender] = amount;
                return false;
            }
        }
        emit BidWithdrawn(msg.sender);
        return true;
    }

    /// End the auction and send the highest bid
    /// to the owner and the tulip to the highest bidder
    function endAuction(uint256 id) public {
        require(now >= auctionEnds[id], "Auction not yet ended.");
        require(!ended[id], "endAuction has already been called.");

        ended[id] = true;
        Bid memory highestBid = bids[id][bidCounts[id] - 1];
        emit AuctionEnded(id, highestBid.bidder, highestBid.amount);

        // Only bother transferring if the highest bidder is not this contract itself.
        if (highestBid.bidder != address(this)) {
            owner.transfer(highestBid.amount);
            tulips.safeTransferFrom(address(this), highestBid.bidder, id);
        }
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes memory data) public returns (bytes4) {

    }

}
