import { connect } from 'react-redux';
import React, { useState, useEffect } from 'react';

import AriaModal from 'react-aria-modal';

import { Base } from '../components/base';

import { fetchUserTulips, connectMetamask } from '../store';

const TulipCard  = ({ tulip, showVideo }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const url = `https://s3.eu-west-2.amazonaws.com/tulips-encoded-1/h264-high/tulip_mp4/tulip${tulip.tokenId+1}.mp4`;

  const onTimerUpdate = () => setTimeLeft(prevTime => prevTime - 1);

  useEffect(() => {
    const currentTime = new Date() / 1000;
    const timeLeft = tulip.creationTime + tulip.lifeSpan - currentTime;
    setTimeLeft(timeLeft);
    const timer = window.setInterval(onTimerUpdate, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [tulip]);

  const secLeft = Math.floor(timeLeft % 60);
  const minLeft = Math.floor((timeLeft / 60) % 60);
  const hrLeft =  Math.floor((timeLeft / 3600) % 24);
  const dayLeft = Math.floor(timeLeft / 86400);

  return (
    <div onClick={showVideo} className="pointer dim">
      <video controls autoplay="autoplay" loop width="128" controlsList="nodownload">
          <source
            src={url}
            type="video/mp4" />
          The tulips are camera shy
      </video>
      <h6 className="f6 fw4 karla near-black ttu mv2">#{tulip.title}</h6>
      <a className="f7 fw3">{`${dayLeft} d ${hrLeft} hr ${minLeft} min ${secLeft} sec left`}</a>
    </div>
  );
};

const TulipsContainer = ({ tulips, showVideo }) => {
  const cards = tulips.map(tulip => (
    <TulipCard key={tulip.title} tulip={tulip} showVideo={() => showVideo(tulip.videoSrc, tulip.title)} />
  ));

  return (
    <div className="cf ph2-ns flex justify-between">
      { cards }
    </div>
  );
};

class Tulips extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      videoModalActive: false,
      videoSrc: null,
      videoTitle: '',
    };
    this.showVideo = this.showVideo.bind(this);
    this.deactivateModal = this.deactivateModal.bind(this);
  }

  componentDidMount() {
    this.props.connectMetamask();
    this.props.fetchUserTulips();
  }

  componentDidUpdate(prevProps) {
    if (this.props.contract != prevProps.contract) {
      this.props.fetchUserTulips();
    }
  }

  showVideo(videoSrc, title) {
    this.setState({
      videoModalActive: true,
      videoSrc,
      videoTitle: title,
    });
  }

  deactivateModal() {
    this.setState({
      ...this.state,
      videoModalActive: false,
    });
  }

  render() {
    const { available } = this.props;
    const { videoTitle, videoSrc, videoModalActive } = this.state;
    const titleToNumber = Number(videoTitle);
    const url = `https://s3.eu-west-2.amazonaws.com/tulips-encoded-1/h264-high/tulip_mp4/tulip${titleToNumber}.mp4`

    return (
      <Base>
        {!available
          && (
          <div className="center mw7 ph3">
            <p className="karla ttu f3 tc">The tulips are dreaming</p>
          </div>
          )
        }
        {available && this.props.tulips.length === 0
          && (
          <div className="center mw7 ph3">
            <p className="karla ttu f3 tc">The tulips are a non-fungible asset</p>
          </div>
          )
        }
        {available && this.props.tulips.length > 0
          && (
          <div className="center mw7 ph3">
            <TulipsContainer tulips={this.props.tulips} showVideo={this.showVideo} />
          </div>
          )
        }
        <AriaModal
          titleText={videoTitle}
          mounted={videoModalActive}
          underlayColor="rgb(32, 45, 47)"
        >
          <div className="karla near-white" tabIndex="0" style={{ outline: 0, width: '100vw' }}>
            <div className="center mw7">
              <div className="flex pt4 pb4 justify-between">
                <a className="ttu">#{videoTitle}</a>
                <a className="pointer underline dim ttu" onClick={this.deactivateModal}>Exit</a>
              </div>
              <div className="flex justify-center mb5">
                <video controls autoplay="autoplay" loop width="512" controlsList="nodownload">
                    <source
                      src={url}
                      type="video/mp4" />
                    The tulips are camera shy
                </video>
              </div>
            </div>
          </div>
        </AriaModal>
      </Base>
    );
  }
}

const mapStateToProps = state => ({
  available: state.metamask.available,
  contract: state.metamask.contract,
  tulips: state.metamask.tulips,
});

const mapDispatchToProps = dispatch => ({
  connectMetamask: () => dispatch(connectMetamask()),
  fetchUserTulips: () => dispatch(fetchUserTulips()),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(Tulips);
