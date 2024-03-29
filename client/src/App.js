import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import gatewayUrl from './gateway';
import Modal from './modal';
import TextInputModal from './textInputModal';

const App = () => {
  // State:
  //
  //   memeFile: a File object returned from <input type="file">
  //   showInvalidFileModal: Boolean. if true, show a modal telling the user the file type is invalid
  //   showLargeFileModal: Boolean. if true, show a modal telling the user the file is too big
  //   userName: String. the user's name
  //   showNoUserNameModal: Boolean. if true, show a modal telling the user they need a name
  //   thumbnails: Array of { id: Number,
  //                          userName: String,
  //                          timePosted: Number (milliseconds since epoch),
  //                          timeToLive: Number (seconds),
  //                          imageUrl: String as base 64 data URL }
  //   displayedMeme: { id: Number,
  //                    imageUrl: String as base 64 data URL,
  //                    userName: String,
  //                    timePosted: Number (milliseconds since epoch),
  //                    timeToLive: Number (seconds),
  //                    likes: [user, user, ...] }
  const [ memeFile, setMemeFile ] = useState(null);
  const [ showInvalidFileModal, setShowInvalidFileModal ] = useState(false);
  const [ showLargeFileModal, setShowLargeFileModal ] = useState(false);
  const [ userName, setUserName ] = useState(null);
  const [ showNoUserNameModal, setShowNoUserNameModal ] = useState(false);
  const [ thumbnails, setThumbnails ] = useState([]);
  const [ displayedMeme, setDisplayedMeme ] = useState(null);

  // Ref:
  //
  //  fileInput: reference to the <input type="file"> element
  const fileInput = useRef();

  const validMemeFileTypes = "image/bmp, image/gif, image/jpeg, image/png, image/tiff";
  const maxMemeSizeMb = 5;

  const healthCheck = () => {
    // this pattern for error handling from fetch() courtesy of
    // https://stackoverflow.com/a/62734322/4062628
    // TODO: figure out if we can refactor this into a generic function to de-DRY
    fetch(`${gatewayUrl}/health-check`)
      .then((response) => {
        if (!response.ok) {
          return Promise.reject(response);
        }

        return response.json()
      })
      .then((body) => {
        alert(`The server is alive and says ${body}`);
      })
      .catch((error) => {
        if (typeof error.json === "function") {
          error.json()
            .then((jsonError) => {
              if (typeof jsonError === "string") {
                alert(`The server is alive, but reports this error: ${jsonError}`);
              } else if (jsonError.hasOwnProperty("message")) {
                alert(`The server is alive, but reports this error: ${jsonError.message}`);
              } else {
                alert("The server is alive but reports an error.")
              }
            })
            .catch(() => {
              alert(`The server is not alive. I received this error: ${error.statusText ?? error}`);
            });
        } else {
          alert(`The server is not alive. I received this error: ${error.statusText ?? error}`)
        }
      });
  };

  // if there are thumbnails showing, set a timer that reduces their TTL once
  // per second. if there's a meme showing, do the same.
  useEffect(() => {
    if ((thumbnails.length === 0) && !displayedMeme) {
      return;
    }

    const timer = setTimeout(() => {
      setThumbnails(
        thumbnails
          .filter(thumbnail => thumbnail.timeToLive > 0)
          .map(thumbnail => { thumbnail.timeToLive--; return thumbnail; }));

      if (displayedMeme) {
        --displayedMeme.timeToLive ?
          setDisplayedMeme(JSON.parse(JSON.stringify(displayedMeme)))
          : setDisplayedMeme(null);
      }
    }, 1000);

    return () => clearTimeout(timer);
  });

  const refreshThumbnails = () => {
    fetch(`${gatewayUrl}/thumbnails`)
      .then((response) => {
        if (!response.ok) {
          return Promise.reject(response);
        }

        return response.json()
      })
      .then((body) => {
        setThumbnails(body);
      })
      .catch((error) => {
        if (typeof error.json === "function") {
          error.json()
            .then((jsonError) => {
              if (typeof jsonError === "string") {
                alert(`The server is alive, but reports this error: ${jsonError}`);
              } else if (jsonError.hasOwnProperty("message")) {
                alert(`The server is alive, but reports this error: ${jsonError.message}`);
              } else {
                alert("The server is alive but reports an error.")
              }
            })
            .catch(() => {
              alert(`The server is not alive. I received this error: ${error.statusText ?? error}`);
            });
        } else {
          alert(`The server is not alive. I received this error: ${error.statusText ?? error}`)
        }

        setThumbnails([]);
      });
  };

  const clearFileSelection = (event) => {
    event.target.value = "";
    setMemeFile(null);
  };

  const onFileChange = (event) => {
    let file = event.target.files[0];

    if (!file 
        || !file.type 
        || !validMemeFileTypes.includes(file.type)) {
      setShowInvalidFileModal(true);
      clearFileSelection(event);
      return;
    }

    if (file.size > maxMemeSizeMb * 1024 * 1024) {
      setShowLargeFileModal(true);
      clearFileSelection(event);
      return;
    }

    setMemeFile(file);
  };

  const onSetUserName = (name) => {
    if (!name.trim()) {
      setShowNoUserNameModal(true);
    } else {
      setUserName(name.trim());
      refreshThumbnails();
    }
  };

  const makeDataUrl = (file) => {
    // converts the binary in a File object to a base 64 data URL
    // see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
    // for an explanation of the format
    // code courtesy of https://stackoverflow.com/a/52311051/4062628. In the
    // original code the author stripped out the data URL header info. We'll
    // leave it in in case the server wants it.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result.toString());
      };
      reader.onerror = (error) => { reject(error); };
      reader.readAsDataURL(file);
    });
  };

  const postMeme = () => {
    makeDataUrl(memeFile)
      .then((encoded) => { 
        return fetch(`${gatewayUrl}/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userName: userName,
              image: encoded
            })
          }
        );
      })
      .then((response) => {
        if (!response.ok) {
          return Promise.reject(response);
        }

        return response.json()
      })
      .then((body) => {
        alert(`Your meme (id ${body.id}) posted!`);
      })
      .catch((error) => {
        if (typeof error.json === "function") {
          error.json()
            .then((jsonError) => {
              if (typeof jsonError === "string") {
                alert(`The server is alive, but reports this error: ${jsonError}`);
              } else if (jsonError.hasOwnProperty("message")) {
                alert(`The server is alive, but reports this error: ${jsonError.message}`);
              } else {
                alert("The server is alive but reports an error.")
              }
            })
            .catch(() => {
              alert(`The server is not alive. I received this error: ${error.statusText ?? error}`);
            });
        } else {
          alert(`The server is not alive or the image was corrupt. I received this error: ${error.statusText ?? error}`)
        }
      })
      .then(() => {
        setMemeFile(null);
        fileInput.current.value = "";
        refreshThumbnails();
      });
  };

  const showMeme = (id) => {
    fetch(`${gatewayUrl}/${id}`)
      .then((response) => {
        if (!response.ok) {
          return Promise.reject(response);
        }

        return response.json()
      })
      .then((body) => {
        setDisplayedMeme(body);
      })
      .catch((error) => {
        if (typeof error.json === "function") {
          error.json()
            .then((jsonError) => {
              if (typeof jsonError === "string") {
                alert(`The server is alive, but reports this error: ${jsonError}`);
              } else if (jsonError.hasOwnProperty("message")) {
                alert(`The server is alive, but reports this error: ${jsonError.message}`);
              } else {
                alert("The server is alive but reports an error.")
              }
            })
            .catch((nonsonError) => {
              alert(`The server is not alive. I received this error: ${error.statusText ?? error}`);
            });
        } else {
          alert(`The server is not alive. I received this error: ${error.statusText ?? error}`)
        }
      });
  };

  const putLike = (memeId) => {
    fetch(`${gatewayUrl}/${memeId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userName: userName })
      })
        .then((response) => {
          if (!response.ok) {
            return Promise.reject(response);
          }

          alert("Thanks for liking this meme!")
          refreshThumbnails();
        })
        .catch((error) => {
          if (typeof error.json === "function") {
            error.json()
              .then((jsonError) => {
                if (typeof jsonError === "string") {
                  alert(`The server is alive, but reports this error: ${jsonError}`);
                } else if (jsonError.hasOwnProperty("message")) {
                  alert(`The server is alive, but reports this error: ${jsonError.message}`);
                } else {
                  alert("The server is alive but reports an error.")
                }
                })
              .catch(() => {
                alert(`The server is not alive. I received this error: ${error.statusText ?? error}`);
              });
          } else {
            alert(`The server is not alive. I received this error: ${error.statusText ?? error}`)
          }
        })
        .then(() => {
          setDisplayedMeme(null);
        });
  }

  const dateString = (epoch) => {
    const date = new Date(epoch * 1000);
    return `${date.toDateString()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  const ttlString = (timeSeconds) => {
    let days = Math.trunc(timeSeconds / (24 * 60 * 60));
    timeSeconds -= days * 24 * 60 * 60;
    let hours = Math.trunc(timeSeconds / (60 * 60));
    timeSeconds -= hours * 60 * 60;
    let minutes = Math.trunc(timeSeconds / 60);
    timeSeconds -= minutes * 60;
    return `${days}d ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${timeSeconds.toString().padStart(2, "0")}`
  };

  const uncasedEquals = (a, b) => a.toLowerCase() === b.toLowerCase();

  // TODO: consider making the individual areas components
  return (
    <div className="container">
      <h1>Immortal Memes!</h1>
      <p>Welcome, {userName}! Post your best memes. But be warned: unless others rate them well, they&apos;ll be short-lived. Can you make an immortal meme?</p>
      <div className="col-2">
          <button type="button" className="btn btn-info" onClick={healthCheck}>Health check</button>
      </div>
      <div className="row align-items-start">
        <div className="col-4">
          <label htmlFor="memeFileChooser" className="form-label">Choose a meme to upload:</label>
          <input 
            className="form-control"
            id="memeFileChooser" 
            type="file" 
            onChange={onFileChange}
            accept={validMemeFileTypes}
            ref={fileInput} />
        </div>
        <div className="col-6">
          {memeFile && (
            <div>
              <p>Size: {Math.round(memeFile.size / 1024)} KiB</p>
              <img src={URL.createObjectURL(memeFile)} alt="Meme to post" className="img-fluid"></img>
            </div>
          )}
        </div>
        <div className="col-2">
          <button className="btn btn-primary mt-3" disabled={!memeFile} onClick={postMeme}>Post!</button>
        </div>
      </div>
      <hr />
      <div className="row align-items-start">
        <div className="col">
          {
            thumbnails.map((thumbnail) => (
              <div className="d-inline-block border border-primary m-2 p-2 selectCursor" onClick={() => { showMeme(thumbnail.id); }} key={thumbnail.id}>
                <img className="img-thumbnail" src={thumbnail.imageUrl} alt="Meme thumbnail"></img>
                <p className="mt-4 mb-0">User: {thumbnail.userName}</p>
                <p className="m-0">Posted: {dateString(thumbnail.timePosted)}</p>
                <p className="m-0">Time left: {ttlString(thumbnail.timeToLive)}</p>
              </div>
            ))
          }
        </div>
      </div>
      <Modal show={showInvalidFileModal}>
        <p>You must select an image file. Try again!</p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setShowInvalidFileModal(false); }}
        >Got it</button>
      </Modal>
      <TextInputModal show={!userName && gatewayUrl && !showNoUserNameModal} onOk={onSetUserName} onCancel={() => { setShowNoUserNameModal(true); }}>
        <p>Enter your user name:</p>
      </TextInputModal>
      <Modal show={showNoUserNameModal}>
        <p>You must set a user name. Try again!</p>
        <button
          className="btn btn-primary btn-sm"
          onClick = {() => { setShowNoUserNameModal(false); }}
        >Got it</button>
      </Modal>
      <Modal show={showLargeFileModal}>
        <p>The max file size for a meme is {maxMemeSizeMb} MB. Try again!</p>
        <button
          className="btn btn-primary btn-sm"
          onClick = {() => { setShowLargeFileModal(false); }}
        >Got it</button>
      </Modal>
      {displayedMeme && // if displayedMeme is null, use null, otherwise use <Modal...>
        <Modal show={displayedMeme}>
          <p>On {dateString(displayedMeme.timePosted)}, {uncasedEquals(displayedMeme.userName, userName) ? "you" : displayedMeme.userName} posted:</p>
          <img src={displayedMeme.imageUrl} className="w-100" alt="Meme to view"></img>
          <p>Time left: {ttlString(displayedMeme.timeToLive)}</p>
          <p><span>Likes:</span> {displayedMeme.likes.length}</p>
          { // only show the like button if this is another user's meme and this user hasn't already liked it
            !uncasedEquals(displayedMeme.userName, userName) && !(displayedMeme.likes.find((liker) => uncasedEquals(liker, userName))) ?
            <button className="btn btn-primary mx-1" onClick={() => { putLike(displayedMeme.id); }}>Like!</button>
            : null
          }
          <button className="btn btn-primary mx-1" onClick={() => { setDisplayedMeme(null); }}>Close</button>
        </Modal>
      }
      <Modal show={!gatewayUrl}>
        <h1>Error</h1>
        <p>
          There&apos;s no gateway URL defined. Edit client/gateway.js to define it,
          then rebuild the client using &apos;npm run build&apos;.
        </p>
      </Modal>
    </div>
  );
};

export default App;
