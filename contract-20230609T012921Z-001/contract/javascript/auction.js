import { connect } from 'react-redux';
import React, { useEffect, useState } from 'react';

import AriaModal from 'react-aria-modal';

import StatusBar from '../../components/statusbar';
import { Base } from '../../components/base';
import { connectMetamask, checkMetamask, fetchAuctionData, clearAuctionData } from '../../store';

const contract = 'This is the contract...';

class BidForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      contractModalActive: false,
      bid: null,
      bidAmount: 0,
      timeLeft: 0,
    };
    this.sendBidOrder = this.sendBidOrder.bind(this);
    this.setBidAmount = this.setBidAmount.bind(this);
    this.endAuction = this.endAuction.bind(this);
  }

  setUpTimer() {
    const currentTime = new Date() / 1000;
    const timeLeft = this.props.auction.auctionEnds - currentTime;

    this.setState({ timeLeft });
    this.timer = window.setInterval(
      () => this.setState({ timeLeft: this.state.timeLeft - 1}),
      1000,
    );
  }

  destroyTimer() {
    if (this.timer) {
      window.clearInterval(this.timer);
    }
  }

  componentWillUnmount() {
    this.destroyTimer();
  }

  componentDidMount() {
    this.destroyTimer();
    this.setUpTimer();
  }

  componentDidUpdate(prevProps) {
    if (this.props.auction !== prevProps.auction) {
      this.destroyTimer();
      this.setUpTimer();
    }
  }

  setBidAmount(event) {
    this.setState({ bidAmount: event.currentTarget.value });
    event.preventDefault();
  }

  sendBidOrder(event) {
    window.contract.bid(
      this.props.auctionId,
      {from: web3.eth.accounts[0],
       value: web3.toWei(this.state.bidAmount, 'ether')});

    window.setTimeout(
      () => { this.setState({ bid: null }); },
      3000,
    );

    event.preventDefault();
  }

  withdrawReturns(event) {
    window.contract.withdraw();
  }

  endAuction(event) {
    window.contract.endAuction(this.props.auctionId).then(() => this.props.fetchAuctionData(this.props.auctionId));
  }

  render() {
    const auctionStr = this.props.auctionStr;
    const timeLeft = this.state.timeLeft;
    const pendingReturns = this.props.auction.pendingReturns;
    const amWinner = this.props.auction.bids[0].address == web3.eth.accounts[0];

    const secLeft = Math.floor(timeLeft % 60);
    const minLeft = Math.floor((timeLeft / 60) % 60);
    const hrLeft =  Math.floor((timeLeft / 3600) % 24);
    const dayLeft = Math.floor(timeLeft / 86400);
    const currentBid = this.state.bid;

    // TODO: just get rid of the bid field instead
    const auctionGoing = this.state.timeLeft >= 0
    const ended = this.props.auction.ended;  // check that transfer has occurred

    if (!this.props.contract) {
      return <p className="karla ttu f5 tc"><h2>The tulips await your transaction</h2></p>
    }

    return (
      <form>
        <style jsx>
          {`
          flex-grow-1 {
            flex-grow: 1;
          }
          `}
        </style>
        <fieldset className="bn pa0">
          <div className="flex items-baseline karla near-black">
            <h2 className="f3 fw4 lh-title mv2">
              {`#${auctionStr}`}
            </h2>
            { auctionGoing && <span className="f6 ph2 flex-grow-1">
              {`${dayLeft} d ${hrLeft} hr ${minLeft} min ${secLeft} sec left`}
            </span> }
            { !auctionGoing && <span className="f6 ph2 flex-grow-1"> Auction Complete</span> }
          </div>
          { auctionGoing && <div className="cf flex w-100 pt2">
            <input className="f6 input-reset ba fl w-80 pa3 flex-grow-1 near-black" type="number" value={this.state.bidAmount} onChange={this.setBidAmount} />
            <input
              className="f6 button-reset fl pv3 ph4 tc ttu ba b--near-black bg-near-black white dim pointer"
              type="submit"
              value="bid"
              onClick={this.sendBidOrder}
            />
          </div> }
          { pendingReturns > 0 && 
            <div className="flex flex-column">
              <p className="">You have ETH {pendingReturns} returns pending</p>
              <a
                className="dib f6 button-reset fl pv1 ph2 tc ttu ba b--near-black bg-near-black white dim pointer"
                onClick={this.withdrawReturns}>
                Withdraw
              </a>
            </div>
          }
          { !auctionGoing && !ended && amWinner &&
            <div className="">
              <a className="dib v-mid">You won! Click to claim</a>
              <a
                className="dib f6 button-reset fr pv1 ph2 tc ttu ba b--near-black bg-near-black white dim pointer"
                onClick={this.endAuction}>
                Claim
              </a>
            </div>

          }
        </fieldset>
      </form>
    );
  }
}

function BidLog({ bids }) {
  return (
    <table className="collapse tl w-100 near-black">
      <tbody>
        <tr>
          <th className="ttu pv2 fw4 karla mid-gray">Bids</th>
          <th className="pv2" />
          <th className="pv2" />
        </tr>
        { bids.map(bid => (
          <tr className="bt bb b--near-black karla" key={ bid.timestamp }>
            <td className="pv3"><strong>{ bid.timestamp }</strong></td>
            <td className="pv3"><strong>{ bid.address }</strong></td>
            <td className="pv3"><strong>ETH { bid.amount }</strong></td>
          </tr>
        )) }
      </tbody>
    </table>
  );
}

class Auction extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      bidsLoaded: false,
      bids: [],
      bid: undefined,
    };
    this.bidEventListener = undefined;
    this.withdrawEventListener = undefined;
  }

  componentDidMount() {
    this.props.connectAccount();
    this.props.fetchAuctionData(this.props.auctionId);
    this.listenEvent();
  }

  componentWillUnmount() {
    this.props.clearAuctionData();
    const bidEvent = this.props.contract.HighestBidIncreased();
    bidEvent.stopWatching();
    this.bidEventListener = undefined;
    this.withdrawEventListener = undefined;
  }

  listenEvent() {
    const _this = this;

    if (this.props.contract && !this.bidEventListener) {
      const bidEvent = this.props.contract.HighestBidIncreased();
      this.bidEventListener = bidEvent.watch((error, result) => {
        if (result.args.auctionId.toNumber() == _this.props.auctionId) {
          if(result.args.bidder == web3.eth.accounts[0]) {
            const timeInMilliSeconds = new Date(result.args.timestamp.toNumber() * 1000);
            const timestamp = timeInMilliSeconds.toLocaleString();
            _this.setState({
              bid: {
                successful: true,
                amount: web3.fromWei(result.args.amount, 'ether').toNumber(),
                timestamp: timestamp,
              },
            });

            setTimeout(() => {
              _this.setState({ bid: undefined })
            }, 4000);
          }
          console.log('event');
          _this.props.fetchAuctionData(this.props.auctionId);
        }
      });
    }

    if (this.props.contract && !this.withdrawEventListener) {
      const bidEvent = this.props.contract.BidWithdrawn();
      this.withdrawEventListener = bidEvent.watch((error, result) => {
        _this.props.fetchAuctionData(this.props.auctionId);
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (!this.props.contract) {
      this.props.connectAccount();
    }
    if (this.props.contract !== prevProps.contract) {
      this.listenEvent();
    }
    if (!this.props.auction || this.props.auctionId != prevProps.auctionId) {
      this.props.fetchAuctionData(this.props.auctionId);
      this.listenEvent();
    }
  }

  render() {
    const currentBid = this.state.bid;
    const idForUrl = this.props.auctionId + 1;
    const url = `https://s3.eu-west-2.amazonaws.com/tulips-encoded-1/h264-high/pixel_mp4/tulip${idForUrl}_pixel.mp4`
    
    return (
      <Base>
        { currentBid && (
          <StatusBar mounted={currentBid}>
            <span>Bid Successful</span>
            <span>{`${currentBid.amount} ${currentBid.timestamp}`}</span>
          </StatusBar>
        )}
        { !this.props.auction && (
          <div className="center mw7 ph3">
            <h2 className="f2 karla">The tulip market is opening</h2>
          </div>
        )}
        { this.props.auction && (
          <div className="center mw7 ph3">
            <div className="pv4 flex flex-column flex-row-ns">
              <div className="w-100 mr2-ns">
                <video controls autoplay="autoplay" loop width="256" controlsList="nodownload">
                    <source 
                      src={url}
                      type="video/mp4" />
                    The tulips are camera shy
                </video>
              </div>
              <div className="w-100 ml2-ns self-center pl4-ns">
                <BidForm {...this.props} />
              </div>
            </div>
            <BidLog bids={this.props.auction.bids} />
          </div>
        )}
      </Base>
    );
  }
}

const mapStateToProps = state => ({
  account: state.metamask.account,
  contract: state.metamask.contract,
  available: state.metamask.available,
  auction: state.metamask.auction,
});

const mapDispatchToProps = dispatch => ({
  connectAccount: () => dispatch(connectMetamask()),
  checkAvailability: () => dispatch(checkMetamask()),
  clearAuctionData: () => dispatch(clearAuctionData()),
  fetchAuctionData: (auctionId) => dispatch(fetchAuctionData(auctionId)),
});

const AuctionContainer = (props) => (
  <Auction {...props} />
);

AuctionContainer.getInitialProps = async ({ query }) => ({
  auctionStr: query.auctionId,
  auctionId: Number(query.auctionId) - 1,
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(AuctionContainer);
